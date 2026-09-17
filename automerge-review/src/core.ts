import * as Automerge from "@automerge/automerge";

import type { Review, ReviewDocument } from "./types.ts";

export type CollaborativeReview = Automerge.Doc<ReviewDocument>;

function assertReviewDocument(document: ReviewDocument): void {
  if (document.document_type !== "evalmerge.review") {
    throw new Error(`Unsupported document type: ${document.document_type}`);
  }
  if (document.schema_version !== "1.0") {
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
  return Automerge.from<ReviewDocument>(structuredClone(document));
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

export function saveReviewDocument(document: CollaborativeReview): Uint8Array {
  return Automerge.save(document);
}

export function loadReviewDocument(data: Uint8Array): CollaborativeReview {
  return Automerge.load<ReviewDocument>(data);
}

export function toPlainReviewDocument(
  document: CollaborativeReview,
): ReviewDocument {
  return Automerge.toJS(document);
}
