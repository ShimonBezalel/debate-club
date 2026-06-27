# Provider Tracing

Debate Club treats provider traces as optional debugging metadata. The canonical record is always the local match artifact and its exported public database entry.

## Defaults

- OpenAI Agents SDK tracing is disabled by default.
- Enable it explicitly with `--tracing`.
- Sensitive trace input and output payloads are disabled.
- Responses API storage remains disabled with `store: false`.
- The adapter force-flushes the SDK trace exporter after each traced run.

Example:

```bash
npm run cli -- run --live --tracing \
  --protocol examples/protocols/classic_v1.yaml \
  --conjecture examples/conjectures/git_backed_ledgers_001.yaml \
  --pro examples/agents/steelman-v1 \
  --con examples/agents/cross-examiner-v1 \
  --judges examples/judges/panels/openai_epistemic_panel_v1 \
  --out matches
```

Each traced debate turn and judge vote stores local metadata where available:

- provider
- agent or judge name
- model
- trace ID
- trace start timestamp
- response-storage policy

The OpenAI Agents SDK exposes trace IDs but does not document a stable per-trace dashboard URL, so Debate Club does not manufacture one. Search the trace ID in the OpenAI platform trace interface.

## “Could not fetch Response”

The platform can list a trace while failing to open an associated Response detail. A likely cause for Debate Club runs is the deliberate `store: false` model setting: trace spans can be exported, but the underlying Responses API object is not retained for later retrieval.

This does not make the Debate Club match incomplete. The complete transcript, scorecard, judge votes, timing, model metadata, and token usage remain in the canonical match artifact and public database.

If provider trace inspection becomes more important than response-retention minimization, add an explicit opt-in storage flag rather than silently changing the default.

## Diagnose

```bash
npm run cli -- doctor
```

The doctor command reports SDK availability, API-key presence, default models, tracing default, and response-storage policy without printing credentials.
