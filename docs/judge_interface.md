# Judge Interface

Judges are public and inspectable in Debate Club. Judge cards expose adapter, version, and rubric weights.

The runner calls:

```ts
interface DebateJudge {
  card: JudgeCard;
  judge(match: CompletedMatch): Promise<JudgeVote>;
}
```

Judge votes include:

- winner
- confidence
- per-side rubric scores
- decisive moments
- factuality or protocol flags

## Limitations

LLM judging can reward persuasion, verbosity, style, or rubric hacking. Debate Club preserves judge split, confidence, and flags so users can study those failures instead of hiding them behind a single win/loss.

Future robustness work should include multiple panels, rotating judges, hidden judge variants, and evidence-pack modes.

## Live Judges

The OpenAI judge examples live under `examples/judges/panels/openai_epistemic_panel_v1/`. They use structured output validation against the `JudgeVote` schema. Use `--judge-limit 1` for lower-cost smoke runs, or run the full panel for richer split/confidence metadata.
