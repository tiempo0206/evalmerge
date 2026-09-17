import { describe, expect, it } from "vitest";

import {
  buildConsensusReport,
  computeSampleConsensus,
} from "../src/consensus.ts";
import {
  addReview,
  createReviewDocument,
  forkReviewDocument,
  mergeReviewDocuments,
} from "../src/core.ts";
import type { Review, ReviewDocument } from "../src/types.ts";

const SAMPLE_KEY = "sample-uuid";

function fixtureDocument(): ReviewDocument {
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
        sha256: "a".repeat(64),
      },
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

function review(label: Review["label"], reviewer: string): Review {
  return {
    label,
    comment: `${reviewer} review`,
    updated_at: "2026-09-17T12:00:00Z",
  };
}

function independentlyReviewed(
  base: ReturnType<typeof createReviewDocument>,
  reviewerId: string,
  label: Review["label"],
) {
  return addReview(
    forkReviewDocument(base),
    SAMPLE_KEY,
    reviewerId,
    review(label, reviewerId),
  );
}

describe("review consensus", () => {
  it("computes a majority decision and agreement ratio", () => {
    const base = createReviewDocument(fixtureDocument());
    const alice = independentlyReviewed(base, "alice", "pass");
    const bob = independentlyReviewed(base, "bob", "pass");
    const carol = independentlyReviewed(base, "carol", "fail");
    const merged = mergeReviewDocuments(
      mergeReviewDocuments(alice, bob),
      carol,
    );

    const consensus = computeSampleConsensus(merged, SAMPLE_KEY);

    expect(consensus.votes).toEqual({ pass: 2, fail: 1, unsure: 0 });
    expect(consensus.decision).toBe("pass");
    expect(consensus.agreement).toBeCloseTo(2 / 3);
  });

  it("marks tied votes for arbitration", () => {
    const base = createReviewDocument(fixtureDocument());
    const alice = independentlyReviewed(base, "alice", "pass");
    const bob = independentlyReviewed(base, "bob", "fail");
    const merged = mergeReviewDocuments(alice, bob);

    const report = buildConsensusReport(merged);

    expect(report.samples[SAMPLE_KEY]!.decision).toBe("tie");
    expect(report.needs_arbitration).toEqual([SAMPLE_KEY]);
  });

  it("excludes unresolved same-key conflicts from the vote", () => {
    const base = createReviewDocument(fixtureDocument());
    const first = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "alice",
      review("pass", "first-device"),
    );
    const second = addReview(
      forkReviewDocument(base),
      SAMPLE_KEY,
      "alice",
      review("fail", "second-device"),
    );
    const merged = mergeReviewDocuments(first, second);

    const consensus = computeSampleConsensus(merged, SAMPLE_KEY);

    expect(consensus.decision).toBe("needs_resolution");
    expect(consensus.counted_reviews).toBe(0);
    expect(consensus.unresolved_reviewers).toEqual(["alice"]);
  });

  it("separates unreviewed samples from arbitration", () => {
    const document = createReviewDocument(fixtureDocument());

    const report = buildConsensusReport(document);

    expect(report.reviewed_samples).toBe(0);
    expect(report.pending_review).toEqual([SAMPLE_KEY]);
    expect(report.needs_arbitration).toEqual([]);
    expect(report.mean_agreement).toBeNull();
  });
});
