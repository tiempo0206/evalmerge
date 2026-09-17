import { describe, expect, test } from "vitest";

import {
  benchmarkIncrementalSync,
  createSyntheticReviewDocument,
  runSyncBenchmark,
} from "../src/benchmark.ts";

describe("Automerge sync wire-size benchmark", () => {
  test("creates stable synthetic evaluation documents", () => {
    const document = createSyntheticReviewDocument(10);

    expect(Object.keys(document.samples)).toHaveLength(10);
    expect(document.evaluation.eval_id).toBe("sync-benchmark-10");
    expect(document.samples["sample-0000"]?.id).toBe("contract-0000");
  });

  test("rejects invalid benchmark sizes", () => {
    expect(() => createSyntheticReviewDocument(0)).toThrow(
      "Sample count must be a positive integer",
    );
    expect(() => runSyncBenchmark([])).toThrow(
      "At least one sample count is required",
    );
  });

  test("incremental sync is smaller than a full snapshot", () => {
    const result = benchmarkIncrementalSync(100);

    expect(result.incremental_sync_bytes).toBeLessThan(
      result.steady_state_snapshot_bytes,
    );
    expect(result.reduction_percent).toBeGreaterThan(90);
    expect(result.first_review_sync_bytes).toBeGreaterThanOrEqual(
      result.first_review_snapshot_bytes,
    );
    expect(result.first_review_reduction_percent).toBeLessThanOrEqual(0);
    expect(result.history_changes_before_steady_edit).toBe(6);
    expect(result.sync_messages).toBeGreaterThan(0);
    expect(result.sync_rounds).toBeGreaterThan(0);
  });

  test("reports every requested dataset size", () => {
    const report = runSyncBenchmark([10, 25]);

    expect(report.results.map((result) => result.sample_count)).toEqual([
      10, 25,
    ]);
    expect(report.operation).toBe(
      "first and steady-state human reviews after peer bootstrap",
    );
  });
});
