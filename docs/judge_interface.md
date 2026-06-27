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
