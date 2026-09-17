import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addReview,
  createReviewDocument,
  forkReviewDocument,
  getReviewConflicts,
  resolveReviewConflict,
  toPlainReviewDocument,
} from "./core.ts";
import { buildConsensusReport } from "./consensus.ts";
import { syncReviewDocuments } from "./sync.ts";
import type { ReviewDocument } from "./types.ts";

async function main(): Promise<void> {
  const sourceArgument = process.argv[2];
  if (!sourceArgument) {
    throw new Error(
      "Usage: npm run demo -- INPUT.review.json [OUTPUT.merged.json]",
    );
  }

  const sourcePath = resolve(sourceArgument);
  const outputPath = resolve(
    process.argv[3] ?? sourcePath.replace(/\.review\.json$/, ".merged.json"),
  );
  const source = JSON.parse(
    await readFile(sourcePath, "utf8"),
  ) as ReviewDocument;
  const sampleKey = Object.keys(source.samples)[0];
  if (!sampleKey) {
    throw new Error("Review document contains no samples");
  }

  const base = createReviewDocument(source);
  const handshake = syncReviewDocuments(
    forkReviewDocument(base),
    forkReviewDocument(base),
  );
  const alice = addReview(handshake.left, sampleKey, "alice", {
    label: "pass",
    comment: "The completion matches the expected answer.",
    updated_at: new Date().toISOString(),
  });
  const bob = addReview(handshake.right, sampleKey, "bob", {
    label: "unsure",
    comment: "The mock answer is correct but not semantically informative.",
    updated_at: new Date().toISOString(),
  });
  const reviewSync = syncReviewDocuments(alice, bob, {
    leftState: handshake.leftState,
    rightState: handshake.rightState,
  });

  const firstDevice = addReview(reviewSync.left, sampleKey, "shared-reviewer", {
    label: "pass",
    comment: "Reviewed against the published rubric.",
    updated_at: new Date().toISOString(),
  });
  const secondDevice = addReview(
    reviewSync.right,
    sampleKey,
    "shared-reviewer",
    {
      label: "fail",
      comment: "A concurrent edit from a second device.",
      updated_at: new Date().toISOString(),
    },
  );
  const conflictSync = syncReviewDocuments(firstDevice, secondDevice, {
    leftState: reviewSync.leftState,
    rightState: reviewSync.rightState,
  });
  const conflicted = conflictSync.left;
  const conflicts = getReviewConflicts(
    conflicted,
    sampleKey,
    "shared-reviewer",
  );
  const selectedReview = conflicts.find((review) => review.label === "pass");
  if (!selectedReview) {
    throw new Error("Expected a pass review in the conflict set");
  }
  const resolved = resolveReviewConflict(
    conflicted,
    sampleKey,
    "shared-reviewer",
    {
      selectedReview,
      resolvedBy: "lead-reviewer",
      resolvedAt: new Date().toISOString(),
      reason: "The selected review follows the published rubric.",
    },
  );
  const resolutionSync = syncReviewDocuments(resolved, conflictSync.right, {
    leftState: conflictSync.leftState,
    rightState: conflictSync.rightState,
  });
  const result = toPlainReviewDocument(resolutionSync.left);
  const report = buildConsensusReport(resolutionSync.left);
  const sampleConsensus = report.samples[sampleKey]!;
  const sessions = [handshake, reviewSync, conflictSync, resolutionSync];
  const totalMessages = sessions.reduce(
    (total, session) => total + session.stats.messages,
    0,
  );
  const totalBytes = sessions.reduce(
    (total, session) => total + session.stats.bytes,
    0,
  );

  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Merged sample: ${sampleKey}`);
  console.log(
    `Reviewers: ${Object.keys(result.samples[sampleKey]!.reviews).join(", ")}`,
  );
  console.log(
    `Resolved conflict: ${conflicts.map((review) => review.label).join(" vs ")} -> ${selectedReview.label}`,
  );
  console.log(
    `Consensus: ${sampleConsensus.decision} (${sampleConsensus.votes.pass}/${sampleConsensus.counted_reviews} pass)`,
  );
  console.log(`Sync traffic: ${totalMessages} messages, ${totalBytes} bytes`);
  console.log(`Pending samples: ${report.pending_review.length}`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
