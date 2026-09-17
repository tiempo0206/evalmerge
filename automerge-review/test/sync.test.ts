import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";

import {
  addReview,
  createReviewDocument,
  forkReviewDocument,
  getReviewConflicts,
  resolveReviewConflict,
  toPlainReviewDocument,
} from "../src/core.ts";
import {
  loadReviewSyncState,
  saveReviewSyncState,
  syncReviewDocuments,
} from "../src/sync.ts";
import type { Review, ReviewDocument } from "../src/types.ts";

const SAMPLE_KEY = "sample-uuid";

function fixtureDocument(sha256 = "a".repeat(64)): ReviewDocument {
  return {
    schema_version: "1.1",
    document_type: "evalmerge.review",
    evaluation: {
      eval_id: "eval-1",
      task: "hello_eval",
      model: "mockllm/model",
      created: "2026-09-17T02:32:07Z",
      status: "success",
      source: { filename: "hello.eval", sha256 },
    },
    samples: {
      [SAMPLE_KEY]: {
        sample_uuid: SAMPLE_KEY,
        id: "greeting",
        epoch: 1,
        input: "Hello",
        target: "Expected",
        output: { model: "mockllm", completion: "Expected" },
        scores: { exact: { value: "C" } },
        reviews: {},
        resolutions: {},
      },
    },
  };
}

function review(label: Review["label"], comment: string): Review {
  return {
    label,
    comment,
    updated_at: "2026-09-17T13:00:00Z",
  };
}

describe("incremental review synchronization", () => {
  it("converges after independent offline edits", () => {
    const base = createReviewDocument(fixtureDocument());
    const handshake = syncReviewDocuments(
      forkReviewDocument(base),
      forkReviewDocument(base),
    );
    const left = addReview(
      handshake.left,
      SAMPLE_KEY,
      "alice",
      review("pass", "Alice offline"),
    );
    const right = addReview(
      handshake.right,
      SAMPLE_KEY,
      "bob",
      review("unsure", "Bob offline"),
    );

    const synced = syncReviewDocuments(left, right, {
      leftState: handshake.leftState,
      rightState: handshake.rightState,
    });

    expect(toPlainReviewDocument(synced.left)).toEqual(
      toPlainReviewDocument(synced.right),
    );
    expect(new Set(Automerge.getHeads(synced.left))).toEqual(
      new Set(Automerge.getHeads(synced.right)),
    );
    expect(
      Object.keys(synced.left.samples[SAMPLE_KEY]!.reviews).sort(),
    ).toEqual(["alice", "bob"]);
    expect(synced.stats.messages).toBeGreaterThan(0);
    expect(synced.stats.bytes).toBeGreaterThan(0);
  });

  it("sends no new messages after peers have converged", () => {
    const base = createReviewDocument(fixtureDocument());
    const first = syncReviewDocuments(
      forkReviewDocument(base),
      forkReviewDocument(base),
    );

    const second = syncReviewDocuments(first.left, first.right, {
      leftState: first.leftState,
      rightState: first.rightState,
    });

    expect(second.stats.messages).toBe(0);
    expect(second.stats.bytes).toBe(0);
  });

  it("resumes from serialized peer sync state", () => {
    const base = createReviewDocument(fixtureDocument());
    const first = syncReviewDocuments(
      forkReviewDocument(base),
      forkReviewDocument(base),
    );
    const leftState = loadReviewSyncState(saveReviewSyncState(first.leftState));
    const rightState = loadReviewSyncState(
      saveReviewSyncState(first.rightState),
    );
    const changedLeft = addReview(
      first.left,
      SAMPLE_KEY,
      "alice",
      review("pass", "Added after restart"),
    );

    const resumed = syncReviewDocuments(changedLeft, first.right, {
      leftState,
      rightState,
    });

    expect(resumed.right.samples[SAMPLE_KEY]!.reviews.alice?.label).toBe(
      "pass",
    );
    expect(toPlainReviewDocument(resumed.left)).toEqual(
      toPlainReviewDocument(resumed.right),
    );
  });

  it("propagates a conflict and its later resolution", () => {
    const base = createReviewDocument(fixtureDocument());
    const handshake = syncReviewDocuments(
      forkReviewDocument(base),
      forkReviewDocument(base),
    );
    const left = addReview(
      handshake.left,
      SAMPLE_KEY,
      "alice",
      review("pass", "First device"),
    );
    const right = addReview(
      handshake.right,
      SAMPLE_KEY,
      "alice",
      review("fail", "Second device"),
    );
    const conflicted = syncReviewDocuments(left, right, {
      leftState: handshake.leftState,
      rightState: handshake.rightState,
    });
    const conflicts = getReviewConflicts(conflicted.left, SAMPLE_KEY, "alice");
    const selectedReview = conflicts.find((item) => item.label === "pass")!;
    const resolvedLeft = resolveReviewConflict(
      conflicted.left,
      SAMPLE_KEY,
      "alice",
      {
        selectedReview,
        resolvedBy: "lead-reviewer",
        resolvedAt: "2026-09-17T14:00:00Z",
        reason: "First device followed the rubric.",
      },
    );

    const resolved = syncReviewDocuments(resolvedLeft, conflicted.right, {
      leftState: conflicted.leftState,
      rightState: conflicted.rightState,
    });

    expect(getReviewConflicts(resolved.right, SAMPLE_KEY, "alice")).toEqual([]);
    expect(resolved.right.samples[SAMPLE_KEY]!.reviews.alice?.label).toBe(
      "pass",
    );
    expect(
      resolved.right.samples[SAMPLE_KEY]!.resolutions?.alice?.resolved_by,
    ).toBe("lead-reviewer");
    expect(toPlainReviewDocument(resolved.left)).toEqual(
      toPlainReviewDocument(resolved.right),
    );
  });

  it("rejects peers backed by different Inspect logs", () => {
    const left = createReviewDocument(fixtureDocument("a".repeat(64)));
    const right = createReviewDocument(fixtureDocument("b".repeat(64)));

    expect(() => syncReviewDocuments(left, right)).toThrow(
      "different evaluation logs",
    );
  });
});
