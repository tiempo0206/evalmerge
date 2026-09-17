# Incremental synchronization

EvalMerge uses Automerge's stateful sync protocol to exchange missing changes
instead of sending a complete review document after every offline session.

## Peer state

Each side stores one `SyncState` for the remote peer. The state records what the
remote side is believed to know. It is separate from the review document and
must be updated after every generated or received message.

```text
Left document  + state for Right
       ⇅ Automerge sync messages
Right document + state for Left
```

`syncReviewDocuments` repeatedly performs these steps:

1. Both sides generate their next message from the current document and peer
   state.
2. Non-null messages are delivered to the other document.
3. Each receiver replaces its document and peer state with the returned values.
4. The loop stops when both sides generate no message.

A maximum round limit prevents a protocol bug from causing an infinite loop.

## Reconnection

`saveReviewSyncState` serializes peer state, and `loadReviewSyncState` restores
it after a process restart. A peer can therefore reconnect and continue from the
last known synchronization point.

After convergence, another sync with unchanged documents sends zero messages.
When peers make new offline changes, the next session sends only protocol data
needed to reconcile the missing changes.

## Safety boundary

Before exchanging messages, EvalMerge compares both the Inspect evaluation ID
and source-log SHA-256. Documents from different evaluation runs are rejected.

The current module simulates transport in one process. Automerge sync messages
are binary payloads but are not themselves an authentication or encryption
layer. A production transport must still authenticate peers, authorize access,
and protect messages in transit.

## Observability

Every session returns:

- protocol rounds;
- total messages and bytes;
- left-to-right messages and bytes; and
- right-to-left messages and bytes.

These measurements support future comparison of full-document transfer against
incremental synchronization.
