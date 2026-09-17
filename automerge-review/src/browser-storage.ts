import type { CollaborativeReview } from "./core.ts";
import { loadReviewDocument, saveReviewDocument } from "./core.ts";

export const REVIEW_STORAGE_KEY = "evalmerge.review-document.v1";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

export function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function saveReviewToStorage(
  storage: KeyValueStorage,
  document: CollaborativeReview,
): void {
  storage.setItem(
    REVIEW_STORAGE_KEY,
    bytesToBase64(saveReviewDocument(document)),
  );
}

export function loadReviewFromStorage(
  storage: KeyValueStorage,
): CollaborativeReview | null {
  const encoded = storage.getItem(REVIEW_STORAGE_KEY);
  return encoded === null ? null : loadReviewDocument(base64ToBytes(encoded));
}

export function clearStoredReview(storage: KeyValueStorage): void {
  storage.removeItem(REVIEW_STORAGE_KEY);
}
