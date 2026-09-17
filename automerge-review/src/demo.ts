import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addReview,
  createReviewDocument,
  forkReviewDocument,
  mergeReviewDocuments,
  toPlainReviewDocument,
} from "./core.ts";
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
  const alice = addReview(forkReviewDocument(base), sampleKey, "alice", {
    label: "pass",
    comment: "The completion matches the expected answer.",
    updated_at: new Date().toISOString(),
  });
  const bob = addReview(forkReviewDocument(base), sampleKey, "bob", {
    label: "unsure",
    comment: "The mock answer is correct but not semantically informative.",
    updated_at: new Date().toISOString(),
  });
  const merged = mergeReviewDocuments(alice, bob);
  const result = toPlainReviewDocument(merged);

  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Merged sample: ${sampleKey}`);
  console.log(
    `Reviewers: ${Object.keys(result.samples[sampleKey]!.reviews).join(", ")}`,
  );
  console.log(`Output: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
