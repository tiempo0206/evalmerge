import { performance } from "node:perf_hooks";

import * as Automerge from "@automerge/automerge";

import { addReview, createReviewDocument, saveReviewDocument } from "./core.ts";
import { syncReviewDocuments } from "./sync.ts";
import type { CollaborativeReview } from "./core.ts";
import type { ReviewSyncState } from "./sync.ts";
import type { ReviewDocument, ReviewSample } from "./types.ts";

export const SYNC_BENCHMARK_ID = "evalmerge.automerge_sync_wire_size";
export const SYNC_BENCHMARK_VERSION = "1.0";

const BASE_ACTOR = "00000000000000000000000000000001";
const RIGHT_ACTOR = "00000000000000000000000000000002";

export interface SyncBenchmarkResult {
  sample_count: number;
  document_bytes_before_edit: number;
  initial_sync_bytes: number;
  first_review_snapshot_bytes: number;
  first_review_sync_bytes: number;
  first_review_reduction_percent: number;
  history_changes_before_steady_edit: number;
  steady_state_snapshot_bytes: number;
  incremental_sync_bytes: number;
  sync_messages: number;
  sync_rounds: number;
  reduction_percent: number;
  duration_ms: number;
}

export interface SyncBenchmarkReport {
  benchmark: typeof SYNC_BENCHMARK_ID;
  version: typeof SYNC_BENCHMARK_VERSION;
  operation: "first and steady-state human reviews after peer bootstrap";
  results: SyncBenchmarkResult[];
}

interface BootstrapResult {
  left: CollaborativeReview;
  right: CollaborativeReview;
  leftState: ReviewSyncState;
  rightState: ReviewSyncState;
  bytes: number;
}

function bootstrapPeer(leftDocument: CollaborativeReview): BootstrapResult {
  let left = leftDocument;
  let right = Automerge.init<ReviewDocument>(RIGHT_ACTOR);
  let leftState = Automerge.initSyncState();
  let rightState = Automerge.initSyncState();
  let bytes = 0;

  for (let round = 0; round < 100; round += 1) {
    let leftMessage: Automerge.SyncMessage | null;
    let rightMessage: Automerge.SyncMessage | null;
    [leftState, leftMessage] = Automerge.generateSyncMessage(left, leftState);
    [rightState, rightMessage] = Automerge.generateSyncMessage(
      right,
      rightState,
    );
    if (leftMessage === null && rightMessage === null) {
      if (right.evaluation.eval_id !== left.evaluation.eval_id) {
        throw new Error("Initial benchmark peers did not converge");
      }
      return { left, right, leftState, rightState, bytes };
    }
    if (leftMessage !== null) {
      bytes += leftMessage.byteLength;
      [right, rightState] = Automerge.receiveSyncMessage(
        right,
        rightState,
        leftMessage,
      );
    }
    if (rightMessage !== null) {
      bytes += rightMessage.byteLength;
      [left, leftState] = Automerge.receiveSyncMessage(
        left,
        leftState,
        rightMessage,
      );
    }
  }
  throw new Error("Initial benchmark sync exceeded 100 rounds");
}

function syntheticSample(index: number): ReviewSample {
  const sampleId = `contract-${String(index).padStart(4, "0")}`;
  return {
    sample_uuid: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    id: sampleId,
    epoch: 1,
    input: {
      prompt: `Return a structured reliability result for synthetic case ${index}.`,
      context: "x".repeat(180),
    },
    target: { status: "pass", case: index },
    metadata: { category: `category-${index % 10}` },
    output: {
      model: "mockllm/sync-benchmark",
      completion: JSON.stringify({ status: "pass", case: index }),
    },
    scores: {
      contract_compliance: {
        value: "C",
        explanation: "Synthetic benchmark fixture passed its output contract.",
      },
    },
    reviews: {},
    resolutions: {},
  };
}

export function createSyntheticReviewDocument(
  sampleCount: number,
): ReviewDocument {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error("Sample count must be a positive integer");
  }

  const samples: ReviewDocument["samples"] = {};
  for (let index = 0; index < sampleCount; index += 1) {
    samples[`sample-${String(index).padStart(4, "0")}`] =
      syntheticSample(index);
  }
  return {
    schema_version: "1.1",
    document_type: "evalmerge.review",
    evaluation: {
      eval_id: `sync-benchmark-${sampleCount}`,
      task: "contract_reliability",
      model: "mockllm/sync-benchmark",
      created: "2026-09-17T00:00:00Z",
      status: "success",
      source: {
        filename: `synthetic-${sampleCount}.eval`,
        sha256: "a".repeat(64),
      },
    },
    samples,
  };
}

export function benchmarkIncrementalSync(
  sampleCount: number,
): SyncBenchmarkResult {
  const base = createReviewDocument(
    createSyntheticReviewDocument(sampleCount),
    BASE_ACTOR,
  );
  const beforeBytes = saveReviewDocument(base).byteLength;
  let session = bootstrapPeer(base);
  const firstSampleKey = Object.keys(base.samples)[0]!;
  const firstChanged = addReview(
    session.left,
    firstSampleKey,
    "first-reviewer",
    {
      label: "pass",
      comment: "The first human review after importing the evaluation.",
      updated_at: "2026-09-17T00:00:00Z",
    },
  );
  const firstSnapshotBytes = saveReviewDocument(firstChanged).byteLength;
  const firstSync = syncReviewDocuments(firstChanged, session.right, {
    leftState: session.leftState,
    rightState: session.rightState,
  });

  session = {
    left: firstSync.left,
    right: firstSync.right,
    leftState: firstSync.leftState,
    rightState: firstSync.rightState,
    bytes: session.bytes,
  };
  for (let index = 0; index < 4; index += 1) {
    const warmed = addReview(
      session.left,
      firstSampleKey,
      `warmup-reviewer-${index}`,
      {
        label: index % 2 === 0 ? "pass" : "unsure",
        comment: `Warm-up review ${index} establishes realistic change history.`,
        updated_at: `2026-09-17T00:00:0${index + 1}Z`,
      },
    );
    const warmSync = syncReviewDocuments(warmed, session.right, {
      leftState: session.leftState,
      rightState: session.rightState,
    });
    session = {
      left: warmSync.left,
      right: warmSync.right,
      leftState: warmSync.leftState,
      rightState: warmSync.rightState,
      bytes: session.bytes,
    };
  }

  const historyChanges = Automerge.getAllChanges(session.left).length;
  const changed = addReview(
    session.left,
    firstSampleKey,
    "benchmark-reviewer",
    {
      label: "pass",
      comment: "The structured output satisfies the published contract.",
      updated_at: "2026-09-17T00:00:10Z",
    },
  );
  const steadySnapshotBytes = saveReviewDocument(changed).byteLength;

  const startedAt = performance.now();
  const synced = syncReviewDocuments(changed, session.right, {
    leftState: session.leftState,
    rightState: session.rightState,
  });
  const durationMs = performance.now() - startedAt;
  if (
    synced.right.samples[firstSampleKey]!.reviews["benchmark-reviewer"]
      ?.label !== "pass"
  ) {
    throw new Error("Incremental benchmark peers did not converge");
  }

  return {
    sample_count: sampleCount,
    document_bytes_before_edit: beforeBytes,
    initial_sync_bytes: session.bytes,
    first_review_snapshot_bytes: firstSnapshotBytes,
    first_review_sync_bytes: firstSync.stats.bytes,
    first_review_reduction_percent: Number(
      ((1 - firstSync.stats.bytes / firstSnapshotBytes) * 100).toFixed(2),
    ),
    history_changes_before_steady_edit: historyChanges,
    steady_state_snapshot_bytes: steadySnapshotBytes,
    incremental_sync_bytes: synced.stats.bytes,
    sync_messages: synced.stats.messages,
    sync_rounds: synced.stats.rounds,
    reduction_percent: Number(
      ((1 - synced.stats.bytes / steadySnapshotBytes) * 100).toFixed(2),
    ),
    duration_ms: Number(durationMs.toFixed(3)),
  };
}

export function runSyncBenchmark(
  sampleCounts: readonly number[] = [10, 100, 1000],
): SyncBenchmarkReport {
  if (sampleCounts.length === 0) {
    throw new Error("At least one sample count is required");
  }
  return {
    benchmark: SYNC_BENCHMARK_ID,
    version: SYNC_BENCHMARK_VERSION,
    operation: "first and steady-state human reviews after peer bootstrap",
    results: sampleCounts.map(benchmarkIncrementalSync),
  };
}
