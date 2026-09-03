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

The deterministic path uses stubs and requires no API key. The OpenAI Agents SDK path is available through explicit flags and refuses to call the API unless `--live` is set.

Check local live readiness without printing secrets:

```bash
npm run cli -- doctor
```

Dry-run the live harness without API calls:

```bash
npm run cli -- run --dry-run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/git_backed_ledgers_001.yaml --pro examples/agents/steelman-v1 --con examples/agents/cross-examiner-v1 --judges examples/judges/panels/openai_epistemic_panel_v1 --judge-limit 1 --out matches/tmp --match-id dry-run-openai-path
```

Run a low-cost live match:

```bash
npm run cli -- run --live --model gpt-4.1-mini --judge-model gpt-4.1-mini --max-output-tokens 320 --judge-max-output-tokens 900 --temperature 0.4 --judge-limit 1 --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/git_backed_ledgers_001.yaml --pro examples/agents/steelman-v1 --con examples/agents/cross-examiner-v1 --judges examples/judges/panels/openai_epistemic_panel_v1 --out matches --match-id live-git-ledgers-demo
```

Every valid completed match enters the ledger and public database by default. Failed or schema-invalid runs should be stored separately and must not enter the valid ledger.

## Cost And Secrets

Do not commit `.env` files, API keys, private prompts, or model transcripts that expose private harness internals. Keep real SDK runs explicit and keep private harness content out of public prompts and artifacts.

Cost controls:

- `--live` is required for API calls.
- `--dry-run` validates the live path with no API calls.
- `--model` and `--judge-model` select models.
- `--max-output-tokens` caps each model response.
- `--judge-max-output-tokens` lets structured judge JSON use a larger cap than debate turns.
- `--temperature` controls variance.
- `--timeout-ms` aborts long calls.
- `--judge-limit` can cap panel size.
- tracing is disabled by default unless `--tracing` is set.

Provider traces are optional debugging metadata, not canonical match records. See [docs/tracing.md](docs/tracing.md).

## Public Database And Viewer

Export the complete valid ledger into a static, viewer-oriented database:

```bash
npm run cli -- ledger export-public-db --matches matches --out public-db
npm run cli -- ledger validate-public-db --db public-db
npm run cli -- viewer build --db public-db --out viewer-dist
```

The export contains aggregate match, agent, judge, and conjecture indexes plus complete per-match JSON, transcript, and scorecard artifacts. It is designed to be forked, diffed, cited, replayed, and served from any static host.

`public-db/` is a generated projection and is not committed. GitHub Pages deployment rebuilds it and the searchable viewer from the canonical `matches/` ledger on every relevant `main` push.

## Daily Growth

The public archive adds one evergreen debate every day at 03:17 UTC. A deterministic planner maps the UTC date to one of 96 reviewed topics, alternates the two agent harnesses between pro and con, and starts a new numbered season after the catalog completes. Repeating a topic in a later season creates a longitudinal comparison with the current agent and model metadata rather than silently changing the original record.

Daily production uses `gpt-5.6-luna`, six tightly capped turns, one public judge, reasoning effort `none`, no tools, no web access, no tracing, and no provider-side response storage. Based on the existing live corpus average of roughly 8,832 input and 2,033 output tokens, the [published Luna rates](https://developers.openai.com/api/docs/models/gpt-5.6-luna) imply about $0.0042 per match or $1.54 per 365 days. Actual usage and pricing can change; match artifacts preserve observed token usage.

The workflow requires an encrypted repository secret named `OPENAI_API_KEY`. Failed provider runs are not committed and are not retried automatically. To recover a missed UTC date, dispatch the workflow manually:

```bash
gh workflow run daily-debate.yml --repo ShimonBezalel/debate-club -f date=2026-09-04
```

Dispatching a date that already exists is idempotent: the runner makes no model calls and leaves the match unchanged.

## Roadmap

- 0.1 local deterministic debate runner
- 0.2 real SDK agents and judges
- 0.3 evidence-pack debates
- 0.4 cross-examination protocol
- 0.5 web debate mode with citations
- 0.6 league ratings with Elo, then Glicko or TrueSkill
- 0.7 public hosted debate archive and static viewer
- 0.8 private-agent submission protocol
