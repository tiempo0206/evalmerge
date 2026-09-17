import { describe, expect, it } from "vitest";

import {
  addReview,
  createReviewDocument,
  forkReviewDocument,
  getReviewConflicts,
  loadReviewDocument,
  mergeReviewDocuments,
  saveReviewDocument,
  toPlainReviewDocument,
} from "../src/core.ts";
import type { Review, ReviewDocument } from "../src/types.ts";

const SAMPLE_KEY = "sample-uuid";

function fixtureDocument(sha256 = "a".repeat(64)): ReviewDocument {
  return {
    schema_version: "1.0",
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
