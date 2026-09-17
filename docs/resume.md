# Resume and interview material

## One-line description

EvalMerge is a local-first collaborative review system that turns Inspect AI
evaluation logs into auditable Automerge CRDT documents, combines automated
scoring with human consensus, and works offline in a browser.

## 中文简历版本

**EvalMerge — 本地优先的 LLM 评测协作复核系统**
Python, Inspect AI, JSON Schema, TypeScript, Automerge CRDT, Vite, Vitest

- 独立设计并实现从 Inspect AI `.eval` 日志到浏览器人工复核的端到端流程，
  包括版本化 JSON Schema、SHA-256 来源追踪、原子导出、离线持久化和
  JSON/CRDT 双格式备份。
- 设计 10 项 ContractBench 结构化输出可靠性基准及自定义评分器，将失败细分为
  JSON 解析错误、Schema 违反和语义错误；受控正向基线通过 10/10，故障基线
  通过 6/10，并将评分解释完整导入 Review Studio。
- 基于 Automerge 实现多端离线编辑、增量同步、同键冲突检测、显式仲裁和审计轨迹；
  在 10/100/1000 样本稳定会话中，单次评审同步仅 482–492 B，相比完整快照
  减少 84.18%–99.58% 的传输量。
- 构建响应式 Review Studio，支持样本搜索筛选、人工标签、实时共识指标、冲突
  解决及刷新恢复；建立 Python/Node 双 CI，当前 11 个 Python 测试和 21 个
  TypeScript 测试全部通过。

## English resume version

**EvalMerge — Local-first collaborative review for LLM evaluations**
Python, Inspect AI, JSON Schema, TypeScript, Automerge CRDT, Vite, Vitest

- Designed and implemented an end-to-end pipeline from Inspect AI `.eval` logs
  to offline browser review, with a versioned JSON contract, SHA-256 provenance,
  atomic exports, binary CRDT persistence, and JSON/CRDT backups.
- Created the 10-case ContractBench structured-output evaluation and a custom
  scorer that separates JSON syntax, Schema, and semantic failures; calibrated
  it with 10/10 conformant and 6/10 fault-injected controlled baselines.
- Implemented offline peer edits, incremental synchronization, same-key conflict
  inspection, explicit arbitration, and resolution audit trails with Automerge;
  measured 482–492-byte steady-state review syncs and 84.18%–99.58% lower wire
  transfer than full snapshots across 10–1000 samples.
- Built a responsive local Review Studio for search, filtering, human labels,
  live consensus, conflict resolution, and refresh-safe persistence; maintained
  dual Python/Node CI with 32 automated tests.

## Evidence map

| Resume claim | Repository evidence |
| --- | --- |
| Inspect export and provenance | `src/evalmerge/export.py`, `schemas/review-document.schema.json` |
| ContractBench and failure taxonomy | `src/evalmerge/benchmark.py`, `src/evalmerge/data/structured_output_cases.json` |
| Controlled benchmark results | `benchmarks/results/contract-conformant.json`, `benchmarks/results/contract-brittle.json` |
| CRDT conflicts and consensus | `automerge-review/src/core.ts`, `automerge-review/src/consensus.ts` |
| Incremental peer sync | `automerge-review/src/sync.ts` |
| Wire-size measurements | `automerge-review/src/benchmark.ts`, `benchmarks/results/automerge-sync-wire-size.json` |
| Browser product | `automerge-review/web/`, `docs/review-studio.md` |
| Verification history | `.github/workflows/test.yml`, `docs/project-logs/` |

## Interview talking points

1. **Why a CRDT?** Reviewers must be able to work offline without a central
   lock. Independent reviewer keys merge automatically, while concurrent writes
   to the same identity remain inspectable and require an auditable product
   decision.
2. **Why keep both JSON and binary formats?** JSON is portable and readable, but
   cannot preserve causal history or concurrent alternatives. Automerge binary
   is the durable local form; JSON export is blocked until conflicts are resolved.
3. **What did the negative benchmark reveal?** The first edit after importing a
   large document can be slightly more expensive than a snapshot because
   Automerge v2 switches to full-document encoding when too much of the small
   change graph is missing. Steady-state incremental benefits appear as history
   grows, so both phases are reported.
4. **How is measurement leakage avoided?** Controlled profiles are explicitly
   labeled as scorer calibration. They validate the evaluation instrument but
   are not claimed as production-model performance.

## Claim boundaries

- Do not describe the controlled `mockllm` profiles as real LLM benchmark
  results. Production-model comparison remains a next milestone.
- Do not claim a remote collaborative service; the current transport protocol is
  implemented and measured locally, while authenticated networking is planned.
- Latency values depend on hardware. Prefer the reproducible byte counts and
  percentages when presenting benchmark results.
