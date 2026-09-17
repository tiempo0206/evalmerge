import {
  addReview,
  createReviewDocument,
  getReviewConflicts,
  loadReviewDocument,
  resolveReviewConflict,
  saveReviewDocument,
  toPlainReviewDocument,
} from "../src/core.ts";
import {
  buildConsensusReport,
  computeSampleConsensus,
} from "../src/consensus.ts";
import {
  clearStoredReview,
  loadReviewFromStorage,
  saveReviewToStorage,
} from "../src/browser-storage.ts";
import type { CollaborativeReview } from "../src/core.ts";
import type {
  ConflictResolution,
  Review,
  ReviewDocument,
  ReviewLabel,
  ReviewSample,
} from "../src/types.ts";

let reviewDoc: CollaborativeReview | null = null;
let selectedSampleKey: string | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing interface element: ${id}`);
  return node as T;
}

const emptyState = byId<HTMLElement>("empty-state");
const workspace = byId<HTMLElement>("workspace");
const fileInput = byId<HTMLInputElement>("file-input");
const exportJsonButton = byId<HTMLButtonElement>("export-json");
const exportBinaryButton = byId<HTMLButtonElement>("export-binary");
const resetButton = byId<HTMLButtonElement>("reset-document");
const loadDemoButton = byId<HTMLButtonElement>("load-demo");
const searchInput = byId<HTMLInputElement>("sample-search");
const filterInput = byId<HTMLSelectElement>("sample-filter");
const sampleDetail = byId<HTMLElement>("sample-detail");
const reviewForm = byId<HTMLFormElement>("review-form");
const statusMessage = byId<HTMLElement>("status-message");

function notify(message: string, tone: "success" | "error" = "success"): void {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
  statusMessage.classList.add("visible");
  window.setTimeout(() => statusMessage.classList.remove("visible"), 3600);
}

function displayValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function persist(): void {
  if (!reviewDoc) return;
  try {
    saveReviewToStorage(localStorage, reviewDoc);
  } catch (error) {
    notify(
      `Review saved in memory, but browser persistence failed: ${String(error)}`,
      "error",
    );
  }
}

function download(parts: BlobPart[], type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "review";
}

function decisionClass(decision: string): string {
  if (decision === "pass") return "decision-pass";
  if (decision === "fail") return "decision-fail";
  if (decision === "no_reviews") return "decision-pending";
  return "decision-warn";
}

function createReviewCard(reviewerId: string, review: Review): HTMLElement {
  const card = document.createElement("article");
  card.className = "review-card";

  const heading = document.createElement("div");
  heading.className = "review-card-heading";
  const reviewer = document.createElement("strong");
  reviewer.textContent = reviewerId;
  const label = document.createElement("span");
  label.className = `review-label label-${review.label}`;
  label.textContent = review.label;
  heading.append(reviewer, label);

  const comment = document.createElement("p");
  comment.textContent = review.comment;
  const time = document.createElement("time");
  time.dateTime = review.updated_at;
  time.textContent = new Date(review.updated_at).toLocaleString();
  card.append(heading, comment, time);
  return card;
}

function resolveCandidate(
  reviewerId: string,
  candidate: Review,
  resolverInput: HTMLInputElement,
  reasonInput: HTMLInputElement,
): void {
  if (!reviewDoc || !selectedSampleKey) return;
  try {
    reviewDoc = resolveReviewConflict(
      reviewDoc,
      selectedSampleKey,
      reviewerId,
      {
        selectedReview: candidate,
        resolvedBy: resolverInput.value,
        resolvedAt: new Date().toISOString(),
        reason: reasonInput.value,
      },
    );
    persist();
    render();
    notify(`Resolved ${reviewerId}'s concurrent review.`);
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), "error");
  }
}

function createConflictCard(
  reviewerId: string,
  conflicts: Review[],
): HTMLElement {
  const card = document.createElement("article");
  card.className = "conflict-card";
  const title = document.createElement("h3");
  title.textContent = `${reviewerId}: ${conflicts.length} concurrent versions`;
  const explanation = document.createElement("p");
  explanation.textContent =
    "Choose a version after documenting who made the decision and why.";

  const resolverInput = document.createElement("input");
  resolverInput.placeholder = "Resolver ID";
  resolverInput.setAttribute("aria-label", `Resolver for ${reviewerId}`);
  const reasonInput = document.createElement("input");
  reasonInput.placeholder = "Resolution reason";
  reasonInput.setAttribute("aria-label", `Resolution reason for ${reviewerId}`);
  const controls = document.createElement("div");
  controls.className = "resolution-controls";
  controls.append(resolverInput, reasonInput);

  const candidateList = document.createElement("div");
  candidateList.className = "candidate-list";
  for (const candidate of conflicts) {
    const candidateCard = createReviewCard(reviewerId, candidate);
    candidateCard.classList.add("candidate-card");
    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "button button-small";
    selectButton.textContent = `Select ${candidate.label}`;
    selectButton.addEventListener("click", () =>
      resolveCandidate(reviewerId, candidate, resolverInput, reasonInput),
    );
    candidateCard.append(selectButton);
    candidateList.append(candidateCard);
  }
  card.append(title, explanation, controls, candidateList);
  return card;
}

function createResolutionCard(
  reviewerId: string,
  resolution: ConflictResolution,
): HTMLElement {
  const card = document.createElement("article");
  card.className = "audit-card";
  const heading = document.createElement("div");
  heading.className = "review-card-heading";
  const title = document.createElement("strong");
  title.textContent = reviewerId;
  const selected = document.createElement("span");
  selected.className = `review-label label-${resolution.selected_review.label}`;
  selected.textContent = `selected ${resolution.selected_review.label}`;
  heading.append(title, selected);
  const reason = document.createElement("p");
  reason.textContent = resolution.reason;
  const metadata = document.createElement("small");
  metadata.textContent = `${resolution.resolved_by} · ${new Date(resolution.resolved_at).toLocaleString()} · ${resolution.conflicting_reviews.length} original versions`;
  card.append(heading, reason, metadata);
  return card;
}

function renderReviews(sample: ReviewSample): void {
  if (!reviewDoc || !selectedSampleKey) return;
  const list = byId<HTMLElement>("review-list");
  list.replaceChildren();
  const reviewerIds = Object.keys(sample.reviews).sort();
  if (reviewerIds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted-empty";
    empty.textContent = "No human reviews yet.";
    list.append(empty);
  }
  for (const reviewerId of reviewerIds) {
    const conflicts = getReviewConflicts(
      reviewDoc,
      selectedSampleKey,
      reviewerId,
    );
    list.append(
      conflicts.length > 1
        ? createConflictCard(reviewerId, conflicts)
        : createReviewCard(reviewerId, sample.reviews[reviewerId]!),
    );
  }

  const resolutionList = byId<HTMLElement>("resolution-list");
  resolutionList.replaceChildren();
  const resolutions = Object.entries(sample.resolutions ?? {});
  if (resolutions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted-empty";
    empty.textContent = "No conflicts have been resolved for this sample.";
    resolutionList.append(empty);
  } else {
    for (const [reviewerId, resolution] of resolutions) {
      resolutionList.append(createResolutionCard(reviewerId, resolution));
    }
  }
}

function renderDetail(): void {
  if (!reviewDoc || !selectedSampleKey) return;
  const sample = reviewDoc.samples[selectedSampleKey];
  if (!sample) return;
  const consensus = computeSampleConsensus(reviewDoc, selectedSampleKey);

  byId("sample-key").textContent = selectedSampleKey;
  byId("sample-title").textContent = `Sample ${String(sample.id)}`;
  const decision = byId("sample-decision");
  decision.textContent = consensus.decision.replaceAll("_", " ");
  decision.className = `decision-badge ${decisionClass(consensus.decision)}`;
  byId("sample-input").textContent = displayValue(sample.input);
  byId("sample-target").textContent = displayValue(sample.target);
  byId("sample-output").textContent = sample.output.completion;
  byId("sample-scores").textContent = displayValue(sample.scores);
  byId("vote-summary").textContent =
    `${consensus.votes.pass} pass · ${consensus.votes.fail} fail · ` +
    `${consensus.votes.unsure} unsure`;
  renderReviews(sample);
}

function filteredSampleKeys(): string[] {
  if (!reviewDoc) return [];
  const report = buildConsensusReport(reviewDoc);
  const query = searchInput.value.trim().toLowerCase();
  const filter = filterInput.value;
  return Object.entries(reviewDoc.samples)
    .filter(([sampleKey, sample]) => {
      const searchable =
        `${sampleKey} ${String(sample.id)} ${displayValue(sample.input)}`.toLowerCase();
      if (query && !searchable.includes(query)) return false;
      const decision = report.samples[sampleKey]!.decision;
      if (filter === "pending") return decision === "no_reviews";
      if (filter === "arbitration")
        return report.needs_arbitration.includes(sampleKey);
      if (filter === "pass" || filter === "fail") return decision === filter;
      return true;
    })
    .map(([sampleKey]) => sampleKey);
}

function renderSampleList(): void {
  if (!reviewDoc) return;
  const list = byId<HTMLElement>("sample-list");
  list.replaceChildren();
  const keys = filteredSampleKeys();
  byId("visible-count").textContent = String(keys.length);
  for (const sampleKey of keys) {
    const sample = reviewDoc.samples[sampleKey]!;
    const consensus = computeSampleConsensus(reviewDoc, sampleKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sample-item";
    if (sampleKey === selectedSampleKey) button.classList.add("active");
    const identity = document.createElement("span");
    identity.textContent = String(sample.id);
    const state = document.createElement("span");
    state.className = `sample-state ${decisionClass(consensus.decision)}`;
    state.textContent = consensus.decision.replaceAll("_", " ");
    button.append(identity, state);
    button.addEventListener("click", () => {
      selectedSampleKey = sampleKey;
      render();
    });
    list.append(button);
  }
  if (keys.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted-empty";
    empty.textContent = "No samples match this view.";
    list.append(empty);
  }
}

function render(): void {
  const hasDocument = reviewDoc !== null;
  emptyState.hidden = hasDocument;
  workspace.hidden = !hasDocument;
  exportJsonButton.disabled = !hasDocument;
  exportBinaryButton.disabled = !hasDocument;
  if (!reviewDoc) return;

  const report = buildConsensusReport(reviewDoc);
  const visibleKeys = filteredSampleKeys();
  if (!selectedSampleKey || !visibleKeys.includes(selectedSampleKey)) {
    selectedSampleKey = visibleKeys[0] ?? null;
  }
  byId("evaluation-name").textContent = reviewDoc.evaluation.task;
  byId("evaluation-meta").textContent =
    `${reviewDoc.evaluation.model} · ${reviewDoc.evaluation.source.filename}`;
  byId("metric-total").textContent = String(report.sample_count);
  byId("metric-reviewed").textContent = String(report.reviewed_samples);
  byId("metric-arbitration").textContent = String(
    report.needs_arbitration.length,
  );
  byId("metric-agreement").textContent =
    report.mean_agreement === null
      ? "—"
      : `${Math.round(report.mean_agreement * 100)}%`;

  const hasUnresolved = Object.values(report.samples).some(
    (sample) => sample.decision === "needs_resolution",
  );
  exportJsonButton.disabled = hasUnresolved;
  exportJsonButton.title = hasUnresolved
    ? "Resolve all conflicts before exporting JSON; CRDT export remains available."
    : "Export readable review JSON";
  renderSampleList();
  sampleDetail.hidden = selectedSampleKey === null;
  if (selectedSampleKey !== null) renderDetail();
}

async function importDocument(file: File): Promise<void> {
  if (file.name.endsWith(".automerge")) {
    reviewDoc = loadReviewDocument(new Uint8Array(await file.arrayBuffer()));
  } else {
    const parsed = JSON.parse(await file.text()) as ReviewDocument;
    reviewDoc = createReviewDocument(parsed);
  }
  selectedSampleKey = Object.keys(reviewDoc.samples)[0] ?? null;
  persist();
  render();
  notify(`Imported ${file.name}.`);
}

loadDemoButton.addEventListener("click", async () => {
  try {
    const response = await fetch("/demo-review.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    reviewDoc = createReviewDocument((await response.json()) as ReviewDocument);
    selectedSampleKey = Object.keys(reviewDoc.samples)[0] ?? null;
    persist();
    render();
    notify("Loaded the two-sample EvalMerge demo.");
  } catch (error) {
    notify(`Demo failed to load: ${String(error)}`, "error");
  }
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    await importDocument(file);
  } catch (error) {
    notify(
      `Import failed: ${error instanceof Error ? error.message : error}`,
      "error",
    );
  } finally {
    fileInput.value = "";
  }
});

reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!reviewDoc || !selectedSampleKey) return;
  const reviewerId = byId<HTMLInputElement>("reviewer-id").value.trim();
  const label = byId<HTMLSelectElement>("review-label").value as ReviewLabel;
  const comment = byId<HTMLTextAreaElement>("review-comment").value.trim();
  if (!reviewerId || !comment) {
    notify("Reviewer ID and comment are required.", "error");
    return;
  }
  try {
    reviewDoc = addReview(reviewDoc, selectedSampleKey, reviewerId, {
      label,
      comment,
      updated_at: new Date().toISOString(),
    });
    persist();
    byId<HTMLTextAreaElement>("review-comment").value = "";
    render();
    notify(`Saved ${label} review for ${reviewerId}.`);
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), "error");
  }
});

exportJsonButton.addEventListener("click", () => {
  if (!reviewDoc) return;
  const task = safeName(reviewDoc.evaluation.task);
  download(
    [`${JSON.stringify(toPlainReviewDocument(reviewDoc), null, 2)}\n`],
    "application/json",
    `${task}.review.json`,
  );
});

exportBinaryButton.addEventListener("click", () => {
  if (!reviewDoc) return;
  const task = safeName(reviewDoc.evaluation.task);
  download(
    [saveReviewDocument(reviewDoc)],
    "application/octet-stream",
    `${task}.automerge`,
  );
});

resetButton.addEventListener("click", () => {
  clearStoredReview(localStorage);
  reviewDoc = null;
  selectedSampleKey = null;
  searchInput.value = "";
  filterInput.value = "all";
  render();
  notify("Cleared the local review document.");
});

searchInput.addEventListener("input", render);
filterInput.addEventListener("change", render);

try {
  reviewDoc = loadReviewFromStorage(localStorage);
  selectedSampleKey = reviewDoc
    ? (Object.keys(reviewDoc.samples)[0] ?? null)
    : null;
} catch (error) {
  clearStoredReview(localStorage);
  notify(`Stored review could not be restored: ${String(error)}`, "error");
}
render();
