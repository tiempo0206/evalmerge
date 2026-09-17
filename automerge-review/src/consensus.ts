import { getReviewConflicts } from "./core.ts";
import type { CollaborativeReview } from "./core.ts";
import type { ReviewLabel } from "./types.ts";

export type ConsensusDecision =
  ReviewLabel | "tie" | "no_reviews" | "needs_resolution";

export interface SampleConsensus {
  sample_key: string;
  total_reviewers: number;
  counted_reviews: number;
  votes: Record<ReviewLabel, number>;
  decision: ConsensusDecision;
  agreement: number | null;
  unresolved_reviewers: string[];
}

export interface ConsensusReport {
  sample_count: number;
  reviewed_samples: number;
  pending_review: string[];
  needs_arbitration: string[];
  mean_agreement: number | null;
  samples: Record<string, SampleConsensus>;
}

const LABELS: ReviewLabel[] = ["pass", "fail", "unsure"];

export function computeSampleConsensus(
  document: CollaborativeReview,
  sampleKey: string,
): SampleConsensus {
  const sample = document.samples[sampleKey];
  if (!sample) {
    throw new Error(`Unknown sample key: ${sampleKey}`);
  }

  const votes: Record<ReviewLabel, number> = {
    pass: 0,
    fail: 0,
    unsure: 0,
  };
  const unresolvedReviewers: string[] = [];

  for (const [reviewerId, review] of Object.entries(sample.reviews)) {
    if (getReviewConflicts(document, sampleKey, reviewerId).length > 1) {
      unresolvedReviewers.push(reviewerId);
    } else {
      votes[review.label] += 1;
    }
  }

  const countedReviews = Object.values(votes).reduce(
    (total, count) => total + count,
    0,
  );
  const largestVote = Math.max(...Object.values(votes));
  const winners = LABELS.filter((label) => votes[label] === largestVote);

  let decision: ConsensusDecision;
  if (unresolvedReviewers.length > 0) {
    decision = "needs_resolution";
  } else if (countedReviews === 0) {
    decision = "no_reviews";
  } else if (winners.length > 1) {
    decision = "tie";
  } else {
    decision = winners[0]!;
  }

  return {
    sample_key: sampleKey,
    total_reviewers: Object.keys(sample.reviews).length,
    counted_reviews: countedReviews,
    votes,
    decision,
    agreement: countedReviews === 0 ? null : largestVote / countedReviews,
    unresolved_reviewers: unresolvedReviewers.sort(),
  };
}

export function buildConsensusReport(
  document: CollaborativeReview,
  minimumAgreement = 2 / 3,
): ConsensusReport {
  if (minimumAgreement < 0 || minimumAgreement > 1) {
    throw new Error("Minimum agreement must be between 0 and 1");
  }

  const samples = Object.fromEntries(
    Object.keys(document.samples).map((sampleKey) => [
      sampleKey,
      computeSampleConsensus(document, sampleKey),
    ]),
  );
  const results = Object.values(samples);
  const pendingReview = results
    .filter((result) => result.decision === "no_reviews")
    .map((result) => result.sample_key);
  const needsArbitration = results
    .filter(
      (result) =>
        result.decision === "needs_resolution" ||
        result.decision === "tie" ||
        result.decision === "unsure" ||
        (result.agreement !== null && result.agreement < minimumAgreement),
    )
    .map((result) => result.sample_key);
  const agreementValues = results
    .map((result) => result.agreement)
    .filter((agreement): agreement is number => agreement !== null);

  return {
    sample_count: results.length,
    reviewed_samples: results.length - pendingReview.length,
    pending_review: pendingReview,
    needs_arbitration: needsArbitration,
    mean_agreement:
      agreementValues.length === 0
        ? null
        : agreementValues.reduce((total, value) => total + value, 0) /
          agreementValues.length,
    samples,
  };
}
