import { describe, expect, it } from "vitest";

import {
  base64ToBytes,
  bytesToBase64,
  clearStoredReview,
  loadReviewFromStorage,
  saveReviewToStorage,
} from "../src/browser-storage.ts";
import {
  addReview,
  createReviewDocument,
  toPlainReviewDocument,
} from "../src/core.ts";
import type { KeyValueStorage } from "../src/browser-storage.ts";
import type { ReviewDocument } from "../src/types.ts";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

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
      source: { filename: "hello.eval", sha256: "a".repeat(64) },
    },
    samples: {
      sample: {
        sample_uuid: "sample",
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

describe("browser persistence", () => {
  it("round-trips arbitrary binary bytes through base64", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);

    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("stores and restores complete Automerge history", () => {
    const storage = new MemoryStorage();
    const reviewed = addReview(
      createReviewDocument(fixtureDocument()),
      "sample",
      "alice",
      {
        label: "pass",
        comment: "Stored locally",
        updated_at: "2026-09-17T15:00:00Z",
      },
    );

    saveReviewToStorage(storage, reviewed);
    const restored = loadReviewFromStorage(storage)!;

    expect(toPlainReviewDocument(restored)).toEqual(
      toPlainReviewDocument(reviewed),
    );
    clearStoredReview(storage);
    expect(loadReviewFromStorage(storage)).toBeNull();
  });
});
