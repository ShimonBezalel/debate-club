# Architecture

Debate Club is a TypeScript CLI package with a deterministic local execution path.

```text
CLI
  -> schema loaders
  -> agent and judge loaders
  -> runner
  -> scoring
  -> artifact writer
  -> ledger index, replay, leaderboard
```

## Runner Flow

1. Load a conjecture and protocol from YAML.
2. Load pro and con agent cards from directories.
3. Load a public judge panel.
4. Prepare both agents with a `MatchContext`.
5. Execute every protocol turn in order.
6. Record text, timing, and token estimates.
7. Notify both agents after each public turn.
8. Ask judges for structured votes.
9. Aggregate winner, split, confidence, variance, and flags.
10. Write match artifacts and rebuild `matches/index.json`.

## Boundaries

The runner depends on interfaces, not provider internals:

- `DebateAgent`: `prepare`, `speak`, `observe`.
- `DebateJudge`: `judge`.
- `writeMatchArtifacts`: serializes completed matches.
- `rebuildLedgerIndex`: regenerates the Git-backed debate archive.

Private agent harnesses can keep prompts, scratchpads, and model routing outside the public repo. Public cards declare capabilities and resource limits.

## Current Adapter Status

`stub` is fully deterministic and used by tests and CI. `openai-agents-sdk` is an optional boundary that verifies credentials and package availability before any future live work.
