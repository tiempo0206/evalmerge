import * as Automerge from "@automerge/automerge";

import type { ConflictResolution, Review, ReviewDocument } from "./types.ts";

export type CollaborativeReview = Automerge.Doc<ReviewDocument>;

function assertReviewDocument(document: ReviewDocument): void {
  if (document.document_type !== "evalmerge.review") {
    throw new Error(`Unsupported document type: ${document.document_type}`);
  }
  if (!["1.0", "1.1"].includes(document.schema_version)) {
    throw new Error(`Unsupported schema version: ${document.schema_version}`);
  }
  if (Object.keys(document.samples).length === 0) {
    throw new Error("Review document contains no samples");
  }
}

function requireSample(document: CollaborativeReview, sampleKey: string): void {
  if (!(sampleKey in document.samples)) {
    throw new Error(`Unknown sample key: ${sampleKey}`);
  }
}

export function createReviewDocument(
  document: ReviewDocument,
): CollaborativeReview {
  assertReviewDocument(document);
  const migrated = structuredClone(document);
  migrated.schema_version = "1.1";
  for (const sample of Object.values(migrated.samples)) {
    sample.resolutions ??= {};
  }
  return Automerge.from<ReviewDocument>(migrated);
}

export function forkReviewDocument(
  document: CollaborativeReview,
): CollaborativeReview {
  return Automerge.clone(document);
}

export function addReview(
  document: CollaborativeReview,
  sampleKey: string,
  reviewerId: string,
  review: Review,
): CollaborativeReview {
  requireSample(document, sampleKey);
  if (reviewerId.trim() === "") {
    throw new Error("Reviewer ID must not be empty");
  }

  return Automerge.change(
    document,
    `Review ${sampleKey} as ${reviewerId}`,
    (draft) => {
      draft.samples[sampleKey]!.reviews[reviewerId] = review;
    },
  );
}

export function mergeReviewDocuments(
  left: CollaborativeReview,
  right: CollaborativeReview,
): CollaborativeReview {
  const leftEvaluation = left.evaluation;
  const rightEvaluation = right.evaluation;
  if (
    leftEvaluation.eval_id !== rightEvaluation.eval_id ||
    leftEvaluation.source.sha256 !== rightEvaluation.source.sha256
  ) {
    throw new Error("Cannot merge reviews from different evaluation logs");
  }

  return Automerge.merge(Automerge.clone(left), Automerge.clone(right));
}

export function getReviewConflicts(
  document: CollaborativeReview,
  sampleKey: string,
  reviewerId: string,
): Review[] {
  requireSample(document, sampleKey);
  const reviews = document.samples[sampleKey]!.reviews;
  const conflicts = Automerge.getConflicts(reviews, reviewerId);
  return conflicts ? (Object.values(conflicts) as unknown as Review[]) : [];
}

export interface ResolveConflictOptions {
  selectedReview: Review;
  resolvedBy: string;
  resolvedAt: string;
  reason: string;
}

function sameReview(left: Review, right: Review): boolean {
  return (
    left.label === right.label &&
    left.comment === right.comment &&
    left.updated_at === right.updated_at
  );
}

function copyReview(review: Review): Review {
  return {
    label: review.label,
    comment: review.comment,
    updated_at: review.updated_at,
  };
}

export function resolveReviewConflict(
  document: CollaborativeReview,
  sampleKey: string,
  reviewerId: string,
  options: ResolveConflictOptions,
): CollaborativeReview {
  const conflicts = getReviewConflicts(document, sampleKey, reviewerId);
  if (conflicts.length < 2) {
    throw new Error(`No unresolved conflict for reviewer: ${reviewerId}`);
  }
  if (!conflicts.some((review) => sameReview(review, options.selectedReview))) {
    throw new Error("Selected review is not one of the conflicting values");
  }
  if (options.resolvedBy.trim() === "" || options.reason.trim() === "") {
    throw new Error("Conflict resolution requires a resolver and reason");
  }

  const selectedReview = copyReview(options.selectedReview);
  const resolution: ConflictResolution = {
    resolved_by: options.resolvedBy,
    resolved_at: options.resolvedAt,
    reason: options.reason,
    selected_review: selectedReview,
    conflicting_reviews: conflicts.map(copyReview),
  };

  return Automerge.change(
    document,
    `Resolve ${sampleKey} review conflict for ${reviewerId}`,
    (draft) => {
      const sample = draft.samples[sampleKey]!;
      sample.reviews[reviewerId] = selectedReview;
      sample.resolutions ??= {};
      sample.resolutions[reviewerId] = resolution;
      draft.schema_version = "1.1";
    },
  );
}

export function saveReviewDocument(document: CollaborativeReview): Uint8Array {
  return Automerge.save(document);
}

export function loadReviewDocument(data: Uint8Array): CollaborativeReview {
  let document = Automerge.load<ReviewDocument>(data);
  assertReviewDocument(Automerge.toJS(document));
  if (
    document.schema_version === "1.0" ||
    Object.values(document.samples).some(
      (sample) => sample.resolutions === undefined,
    )
  ) {
    document = Automerge.change(
      document,
      "Upgrade review schema to 1.1",
      (draft) => {
        draft.schema_version = "1.1";
        for (const sample of Object.values(draft.samples)) {
          sample.resolutions ??= {};
        }
      },
    );
  }
  return document;
}

export function toPlainReviewDocument(
  document: CollaborativeReview,
): ReviewDocument {
  return Automerge.toJS(document);
}
