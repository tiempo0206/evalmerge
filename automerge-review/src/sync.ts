import * as Automerge from "@automerge/automerge";

import type { CollaborativeReview } from "./core.ts";

export type ReviewSyncState = ReturnType<typeof Automerge.initSyncState>;

export interface SyncDirectionStats {
  messages: number;
  bytes: number;
}

export interface SyncStats {
  rounds: number;
  messages: number;
  bytes: number;
  left_to_right: SyncDirectionStats;
  right_to_left: SyncDirectionStats;
}

export interface SyncOptions {
  leftState?: ReviewSyncState;
  rightState?: ReviewSyncState;
  maxRounds?: number;
}

export interface SyncResult {
  left: CollaborativeReview;
  right: CollaborativeReview;
  leftState: ReviewSyncState;
  rightState: ReviewSyncState;
  stats: SyncStats;
}

function assertMatchingEvaluation(
  left: CollaborativeReview,
  right: CollaborativeReview,
): void {
  if (
    left.evaluation.eval_id !== right.evaluation.eval_id ||
    left.evaluation.source.sha256 !== right.evaluation.source.sha256
  ) {
    throw new Error("Cannot sync reviews from different evaluation logs");
  }
}

export function syncReviewDocuments(
  initialLeft: CollaborativeReview,
  initialRight: CollaborativeReview,
  options: SyncOptions = {},
): SyncResult {
  assertMatchingEvaluation(initialLeft, initialRight);
  const maxRounds = options.maxRounds ?? 100;
  if (!Number.isInteger(maxRounds) || maxRounds < 1) {
    throw new Error("Maximum sync rounds must be a positive integer");
  }

  let left = initialLeft;
  let right = initialRight;
  let leftState = options.leftState ?? Automerge.initSyncState();
  let rightState = options.rightState ?? Automerge.initSyncState();
  const leftToRight: SyncDirectionStats = { messages: 0, bytes: 0 };
  const rightToLeft: SyncDirectionStats = { messages: 0, bytes: 0 };

  for (let round = 1; round <= maxRounds; round += 1) {
    let leftMessage: Automerge.SyncMessage | null;
    let rightMessage: Automerge.SyncMessage | null;
    [leftState, leftMessage] = Automerge.generateSyncMessage(left, leftState);
    [rightState, rightMessage] = Automerge.generateSyncMessage(
      right,
      rightState,
    );

    if (leftMessage === null && rightMessage === null) {
      return {
        left,
        right,
        leftState,
        rightState,
        stats: {
          rounds: round,
          messages: leftToRight.messages + rightToLeft.messages,
          bytes: leftToRight.bytes + rightToLeft.bytes,
          left_to_right: leftToRight,
          right_to_left: rightToLeft,
        },
      };
    }

    if (leftMessage !== null) {
      leftToRight.messages += 1;
      leftToRight.bytes += leftMessage.byteLength;
      [right, rightState] = Automerge.receiveSyncMessage(
        right,
        rightState,
        leftMessage,
      );
    }
    if (rightMessage !== null) {
      rightToLeft.messages += 1;
      rightToLeft.bytes += rightMessage.byteLength;
      [left, leftState] = Automerge.receiveSyncMessage(
        left,
        leftState,
        rightMessage,
      );
    }
  }

  throw new Error(
    `Review documents did not converge within ${maxRounds} rounds`,
  );
}

export function saveReviewSyncState(state: ReviewSyncState): Uint8Array {
  return Automerge.encodeSyncState(state);
}

export function loadReviewSyncState(data: Uint8Array): ReviewSyncState {
  return Automerge.decodeSyncState(data);
}
