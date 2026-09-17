import { describe, expect, it } from "vitest";

import {
  addReview,
  createReviewDocument,
  forkReviewDocument,
  getReviewConflicts,
  loadReviewDocument,
  mergeReviewDocuments,
  resolveReviewConflict,
  saveReviewDocument,
  toPlainReviewDocument,
} from "../src/core.ts";
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
      source: {
        filename: "hello.eval",
        sha256,
      },
    },
    samples: {
      [SAMPLE_KEY]: {
        sample_uuid: SAMPLE_KEY,
        id: "greeting",
        epoch: 1,
        input: "Hello",
        target: "Expected",
        output: {
          model: "mockllm",
          completion: "Expected",
        },
        scores: {
          exact: { value: "C" },
        },
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
    updated_at: "2026-09-17T10:30:00Z",
  };
}

describe("collaborative review documents", () => {
  it("merges independent offline reviews without losing either edit", () => {
    const base = createReviewDocument(fixtureDocument());
    const alice = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "alice",
      review("pass", "Looks correct"),
    );
    const bob = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "bob",
      review("unsure", "Needs a human check"),
    );

    const merged = toPlainReviewDocument(mergeReviewDocuments(alice, bob));

    expect(merged.samples[SAMPLE_KEY]!.reviews).toEqual({
      alice: review("pass", "Looks correct"),
      bob: review("unsure", "Needs a human check"),
    });
    expect(toPlainReviewDocument(base).samples[SAMPLE_KEY]!.reviews).toEqual(
      {},
    );
  });

  it("exposes concurrent reviews written to the same reviewer key", () => {
    const base = createReviewDocument(fixtureDocument());
    const first = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "shared-reviewer",
      review("pass", "First device"),
    );
    const second = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "shared-reviewer",
      review("fail", "Second device"),
    );

    const merged = mergeReviewDocuments(first, second);
    const conflicts = getReviewConflicts(merged, SAMPLE_KEY, "shared-reviewer");

    expect(new Set(conflicts.map((item) => item.label))).toEqual(
      new Set(["pass", "fail"]),
    );
  });

  it("resolves a conflict while preserving an audit record", () => {
    const base = createReviewDocument(fixtureDocument());
    const first = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "shared-reviewer",
      review("pass", "Uses the rubric"),
    );
    const second = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "shared-reviewer",
      review("fail", "Concurrent second edit"),
    );
    const conflicted = mergeReviewDocuments(first, second);
    const conflicts = getReviewConflicts(
      conflicted,
      SAMPLE_KEY,
      "shared-reviewer",
    );
    const selectedReview = conflicts.find((item) => item.label === "pass")!;

    const resolved = resolveReviewConflict(
      conflicted,
      SAMPLE_KEY,
      "shared-reviewer",
      {
        selectedReview,
        resolvedBy: "lead-reviewer",
        resolvedAt: "2026-09-17T11:30:00Z",
        reason: "The pass review follows the published rubric.",
      },
    );
    const plain = toPlainReviewDocument(resolved);
    const resolution =
      plain.samples[SAMPLE_KEY]!.resolutions!["shared-reviewer"]!;

    expect(getReviewConflicts(resolved, SAMPLE_KEY, "shared-reviewer")).toEqual(
      [],
    );
    expect(plain.samples[SAMPLE_KEY]!.reviews["shared-reviewer"]).toEqual(
      selectedReview,
    );
    expect(resolution.resolved_by).toBe("lead-reviewer");
    expect(
      new Set(resolution.conflicting_reviews.map((item) => item.label)),
    ).toEqual(new Set(["pass", "fail"]));
  });

  it("upgrades a version 1.0 document in memory", () => {
    const legacy = fixtureDocument();
    legacy.schema_version = "1.0";
    delete legacy.samples[SAMPLE_KEY]!.resolutions;

    const migrated = toPlainReviewDocument(createReviewDocument(legacy));

    expect(migrated.schema_version).toBe("1.1");
    expect(migrated.samples[SAMPLE_KEY]!.resolutions).toEqual({});
  });

  it("persists and reloads the complete Automerge history", () => {
    const reviewed = addReview(
      createReviewDocument(fixtureDocument()),
      SAMPLE_KEY,
      "alice",
      review("pass", "Stored offline"),
    );

    const reloaded = loadReviewDocument(saveReviewDocument(reviewed));

    expect(toPlainReviewDocument(reloaded)).toEqual(
      toPlainReviewDocument(reviewed),
    );
  });

  it("rejects documents from different evaluation logs", () => {
    const left = createReviewDocument(fixtureDocument("a".repeat(64)));
    const right = createReviewDocument(fixtureDocument("b".repeat(64)));

    expect(() => mergeReviewDocuments(left, right)).toThrow(
      "different evaluation logs",
    );
  });
});
