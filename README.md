# Debate Club

Debate Club is an open match protocol and local runner for private debate agents and public judge panels.

A debate agent is a harness: prompts, skills, model configuration, memory strategy, tools, and debate strategy. Debate Club runs agents over structured conjectures under protocol constraints, asks public judge agents to score the result, and writes every match as an open artifact in a Git-backed ledger.

Debate win rate is not truth. The project tracks persuasion under constraints while preserving judge split, confidence, factuality flags, and transcript data for later analysis.

## Quickstart

```bash
npm install
npm run cli -- run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/ai_tutors_homework_001.yaml --pro examples/agents/stub_pro --con examples/agents/stub_con --judges examples/judges/stub_panel --out matches --match-id local-ai-tutors-stub
npm run cli -- replay matches/local-ai-tutors-stub
npm run cli -- ledger rebuild --matches matches
npm run cli -- leaderboard matches
```

The stub run writes:

- `match.json`
- `transcript.md`
- `transcript.jsonl`
- `judge_votes.json`
- `scorecard.md`
- `timing.json`
- `tool_log.json`
- `matches/index.json`

## Concepts

- Private debater harnesses: the runner calls a narrow `prepare`, `speak`, and `observe` interface.
- Public judges: judge cards and rubrics are visible and inspectable.
- Structured conjectures: topics include domain, truth type, evidence mode, allowed tools, and rubric notes.
- Protocol constraints: `classic_v1` records time and token budgets for each turn.
- Open match ledger: completed debates are committed as reviewable files.

## Example Ledger Entry

The repo includes one deterministic stub match:

- Transcript: `matches/2026-06-27-ai-tutors-stub/transcript.md`
- Scorecard: `matches/2026-06-27-ai-tutors-stub/scorecard.md`
- Index: `matches/index.json`

## Optional SDK Adapter

The deterministic path uses stubs and requires no API key. The OpenAI Agents SDK adapter boundary is optional and refuses to run without `OPENAI_API_KEY` and the optional SDK package. Real model runs should be curated before committing transcripts.

## Cost And Secrets

Do not commit `.env` files, API keys, private prompts, or model transcripts that expose private harness internals. Keep real SDK runs explicit and curated.

## Roadmap

- 0.1 local deterministic debate runner
- 0.2 real SDK agents and judges
- 0.3 evidence-pack debates
- 0.4 cross-examination protocol
- 0.5 web debate mode with citations
- 0.6 league ratings with Elo, then Glicko or TrueSkill
- 0.7 public hosted debate archive
- 0.8 private-agent submission protocol
