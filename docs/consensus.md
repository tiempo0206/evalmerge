# Consensus and arbitration

EvalMerge computes consensus as a derived report. It does not write the result
into the CRDT, because the same review document may be evaluated under different
policies without creating more collaborative changes.

## Vote counting

Each reviewer ID contributes at most one `pass`, `fail`, or `unsure` vote per
sample. If one reviewer ID has unresolved concurrent values, that reviewer is
listed in `unresolved_reviewers` and contributes no vote until the conflict is
resolved. This prevents Automerge's currently visible winner from influencing a
decision arbitrarily.

The sample result contains:

- vote counts for all three labels;
- the number of reviewers and counted reviews;
- `agreement`, calculated as the largest vote count divided by counted reviews;
- a decision: `pass`, `fail`, `unsure`, `tie`, `no_reviews`, or
  `needs_resolution`.

## Arbitration policy

The default minimum agreement is two thirds. A reviewed sample enters
`needs_arbitration` when it has:

- an unresolved same-key conflict;
- tied leading labels;
- an `unsure` majority; or
- agreement below the configured threshold.

Samples with no reviews enter `pending_review`, not `needs_arbitration`.

The threshold can be changed when building a report:

```ts
const report = buildConsensusReport(document, 0.8)
```

## Conflict resolution

A resolution must select one of the actual conflicting reviews. The resolving
change observes and overwrites every concurrent value, which clears the active
Automerge conflict. The document keeps an audit entry containing:

- all original conflicting reviews;
- the selected review;
- resolver ID;
- resolution time; and
- a required reason.
