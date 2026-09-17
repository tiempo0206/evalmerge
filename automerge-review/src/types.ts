export type JsonPrimitive = boolean | number | string | null;

export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ReviewLabel = "pass" | "fail" | "unsure";

export interface Review extends Record<string, JsonValue> {
  label: ReviewLabel;
  comment: string;
  updated_at: string;
}

export interface ConflictResolution extends Record<string, JsonValue> {
  resolved_by: string;
  resolved_at: string;
  reason: string;
  selected_review: Review;
  conflicting_reviews: Review[];
}

export interface ReviewSample {
  sample_uuid: string | null;
  id: string | number | null;
  epoch: number;
  input: JsonValue;
  target: JsonValue;
  metadata?: { [key: string]: JsonValue };
  output: {
    model: string;
    completion: string;
  };
  scores: {
    [scorer: string]: { [key: string]: JsonValue };
  };
  reviews: {
    [reviewerId: string]: Review;
  };
  resolutions?: {
    [reviewerId: string]: ConflictResolution;
  };
}

export interface ReviewDocument extends Record<string, unknown> {
  schema_version: "1.0" | "1.1";
  document_type: "evalmerge.review";
  evaluation: {
    eval_id: string;
    task: string;
    model: string;
    created: string;
    status: string;
    source: {
      filename: string;
      sha256: string;
    };
  };
  samples: {
    [sampleKey: string]: ReviewSample;
  };
}
