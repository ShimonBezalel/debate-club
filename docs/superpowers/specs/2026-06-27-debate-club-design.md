# Debate Club Design

Date: 2026-06-27

## Purpose

Debate Club is an open match protocol and local runner for competitive LLM debate agents.

The core idea is not simply that LLMs can debate. The project treats debate as a constrained self-play environment: private debater harnesses compete over structured conjectures, public judge agents score with transparent rubrics, and every completed match becomes an open artifact in a Git-backed debate ledger.

The project should make one distinction explicit throughout the code and documentation:

> Debate win rate is not truth. Debate Club measures persuasion under constraints while also tracking epistemic hygiene, responsiveness, factuality flags, and robustness across judges and topics.

## Approved Direction

Milestone 0.1 will be a TypeScript/Node CLI-first repository.

The implementation will prove the full local pipeline with deterministic stub agents and stub judges before adding optional real SDK integration. The first real adapter target is the OpenAI Agents SDK for JavaScript/TypeScript if current official docs and package behavior support it cleanly. The adapter boundary must remain provider-neutral so Anthropic Claude Agent SDK, direct provider SDKs, local models, or Python adapters can be added later without changing the runner.

The repository will be published as `ShimonBezalel/debate-club` unless that name becomes unavailable before publication.

## Non-Goals For Milestone 0.1

- No hosted database.
- No marketplace.
- No web app as the primary product.
- No training or automatic self-improvement loop.
- No open-web research mode.
- No political persuasion optimization against real users.
- No complex tournament engine.
- No hidden judge infrastructure.
- No production website publish without a clean preview or reviewable site change.

## Product Shape

The first useful public artifact is a small but real open-source project with:

- A CLI that can run a complete local debate.
- Structured YAML/JSON definitions for conjectures and protocols.
- A narrow debater interface that allows private harnesses.
- Public judge cards and structured judge votes.
- A Git-backed debate ledger under `matches/`.
- Generated transcript, JSONL, scorecard, timing, tool-log, and index artifacts.
- Tests and CI covering the deterministic path.
- Optional real SDK adapter code that is skipped unless credentials are configured.
- README, docs, and a website-ready project page.
- `QUESTIONS.md`, `ASSUMPTIONS.md`, and `DECISIONS.md` so unanswered product choices do not block progress.

## Repository Layout

Expected structure:

```text
debate-club/
  README.md
  LICENSE
  package.json
  tsconfig.json
  src/
    cli/
    runner/
    protocols/
    agents/
    judges/
    scoring/
    ledger/
    schemas/
    adapters/
  examples/
    agents/
      stub_pro/
      stub_con/
      openai_agents_sdk_example/
    judges/
      stub_panel/
      epistemic_judge_v1/
    conjectures/
    protocols/
    matches/
  matches/
    index.json
    <match-id>/
      match.json
      transcript.md
      transcript.jsonl
      judge_votes.json
      scorecard.md
      timing.json
      tool_log.json
  docs/
    architecture.md
    protocol.md
    agent_interface.md
    judge_interface.md
    publishing.md
    superpowers/
      specs/
        2026-06-27-debate-club-design.md
  site/
    debate-club.md
  tests/
  .github/
    workflows/
      ci.yml
  QUESTIONS.md
  ASSUMPTIONS.md
  DECISIONS.md
```

This layout may be adjusted during implementation if TypeScript package conventions require it, but the behavioral surfaces must remain intact.

## Core Concepts

### Conjecture

A conjecture is structured data, not only a sentence. It defines the debate topic, domain, truth type, evidence mode, allowed tools, and judge guidance.

Required truth types:

- `factual_known`
- `factual_uncertain`
- `normative`
- `policy`
- `philosophical`
- `technical_design`
- `strategic`

Required evidence modes for the schema:

- `no_external_info`
- `provided_packet_only`
- `web_allowed_with_citations`
- `tools_allowed`

Milestone 0.1 only needs to execute `no_external_info`. `provided_packet_only` should be represented in the schema and docs as the next serious research mode.

### Protocol

Milestone 0.1 implements `classic_v1`:

1. Prep
2. Pro opening
3. Con opening
4. Pro rebuttal
5. Con rebuttal
6. Pro closing
7. Con closing
8. Judging

The protocol config includes time and token budgets even if local enforcement is approximate in 0.1. The runner must record observed timing and budget metadata so later versions can tighten enforcement without changing match artifact shape.

### Debate Agent

A debate agent is a harness, not just a model call. It can include prompts, skills, memory strategy, tools, model routing, and debate strategy.

The runner calls agents through a narrow interface:

```ts
interface DebateAgent {
  prepare(context: MatchContext): Promise<void>;
  speak(observation: DebateObservation, budget: TurnBudget): Promise<DebateMove>;
  observe(event: DebateEvent): Promise<void>;
}
```

The runner should not inspect private prompts, hidden strategy files, scratchpads, or model routing internals. Public agent cards describe declared capabilities and resource limits. Private folders and secrets must be excluded from commits.

### Debate Judge

Judges are public agents with visible cards and rubrics.

The runner calls judges through a narrow interface:

```ts
interface DebateJudge {
  judge(match: CompletedMatch): Promise<JudgeVote>;
}
```

Judge output must be structured and include:

- `winner`
- `confidence`
- per-side rubric scores
- decisive moments
- factuality or protocol flags

Panel aggregation must preserve judge split, confidence, variance, and flags. It must not collapse the result to only a win/loss.

### Debate Ledger

The open debate database for 0.1 is Git-backed files, not a hosted DB.

Each completed match writes:

- `match.json`
- `transcript.md`
- `transcript.jsonl`
- `judge_votes.json`
- `scorecard.md`
- `timing.json`
- `tool_log.json`

The `matches/index.json` file lists every match with match id, timestamp, conjecture, protocol, agents, judges, winner, judge split, confidence summary, and relative paths.

The CLI must provide `debateclub ledger rebuild` so the index can be regenerated from match folders.

## CLI Surface

Milestone 0.1 should implement:

```bash
debateclub run \
  --protocol examples/protocols/classic_v1.yaml \
  --conjecture examples/conjectures/ai_tutors_homework_001.yaml \
  --pro examples/agents/stub_pro \
  --con examples/agents/stub_con \
  --judges examples/judges/stub_panel \
  --out matches/

debateclub replay matches/<match-id>
debateclub ledger rebuild
debateclub leaderboard matches/
```

`debateclub judge matches/<match-id> --panel examples/judges/stub_panel` is desirable but can be deferred if `run`, `replay`, `ledger rebuild`, and `leaderboard` are complete and tested.

## Data Flow

1. CLI parses inputs and loads YAML configs.
2. Schema validation normalizes conjecture, protocol, agent cards, and judge panel cards.
3. Runner creates a match id and match context.
4. Runner calls `prepare` on both agents with stance assignment and constraints.
5. Runner executes protocol turns in order.
6. Each turn passes an observation and budget to the speaking agent.
7. Runner records the move, timing, token estimate, and any tool events.
8. Runner calls `observe` on both agents after each public event.
9. Runner sends the completed match to each judge.
10. Scoring aggregates judge votes without losing split or confidence data.
11. Artifact writer emits the match folder.
12. Ledger rebuild updates `matches/index.json`.
13. Replay renders an existing transcript from ledger artifacts.
14. Leaderboard computes a simple local summary from match results.

## Error Handling

The CLI should fail with explicit messages for:

- Missing files.
- Invalid YAML or JSON.
- Schema validation failures.
- Unsupported protocol ids.
- Unsupported evidence modes for execution.
- Agent adapter load failures.
- Judge adapter load failures.
- Attempted real SDK use without required environment variables.
- Match output path conflicts.

Failed matches should not silently produce valid-looking ledger entries. If partial artifacts are useful for debugging, they should be clearly marked as failed and excluded from normal leaderboard calculations.

## Adapter Strategy

The deterministic path must not require network access or API keys.

Adapters:

- `stub`: deterministic agents and judges for tests, docs, and CI.
- `openai-agents-sdk`: optional real adapter using environment variables only.
- Future: Anthropic Claude Agent SDK, direct provider SDKs, local models, evidence-pack tools.

The real SDK adapter must:

- Read credentials from environment variables only.
- Support a cheap model configuration.
- Support dry-run or import/config validation without spending money.
- Be skipped in CI unless credentials are explicitly present.
- Be documented as optional.
- Never commit private prompts, keys, transcripts containing secrets, or `.env` files.

Implementation must verify current SDK docs and package behavior before coding the adapter. If the official JS/TS agent SDK path is blocked, the adapter may be documented as near-complete and the direct provider adapter can be used only as a fallback with the reason recorded in `DECISIONS.md`.

## Website Plan

The likely active personal site workspace is `/Users/shimon/ws/shimmybezalel`, an Astro/Vercel site. There is also an older public `ShimonBezalel/shimonbezalel.github.io` repository.

Milestone 0.1 should produce a concise project page with:

- Title: Debate Club
- Subtitle: Open match protocol for private debate agents and public judge panels.
- What it is
- Why debate agents
- How a match works
- Open debate ledger
- Current milestone
- GitHub link
- Example transcript link

Publishing governance:

- Treat the website target as `static` plus `preview` until confirmed otherwise.
- Run the website build or available checks before proposing any website change.
- Prefer a reviewable PR or preview path for site changes.
- If the correct site repo cannot be confirmed confidently, do not force production publication. Generate `site/debate-club.md` inside this repo and add a non-blocking question to `QUESTIONS.md`.

## Tests And Validation

Required test coverage:

- Conjecture YAML loading.
- Protocol YAML loading.
- Deterministic stub debate run.
- Transcript JSONL generation.
- Judge vote schema validation.
- Scorecard generation.
- Ledger index rebuild.
- Replay command.
- Leaderboard command.
- No committed secrets pattern check.

Required validation commands before publication:

- Install dependencies.
- Typecheck.
- Unit tests.
- CLI stub debate run.
- Ledger rebuild.
- Replay generated match.
- Leaderboard over generated ledger.
- CI workflow present.

If website changes are made:

- Install website dependencies if needed.
- Run website checks/build.
- Record preview or local artifact path.

## Documentation Requirements

README must include:

- Crisp thesis.
- Install instructions.
- Quickstart command.
- Example output paths.
- Private debater harnesses.
- Public judges.
- Structured conjectures.
- Protocol constraints.
- Open match ledger.
- SDK adapter status.
- Cost and secrets warning.
- Roadmap.

Docs must include:

- `docs/architecture.md`: system diagram in text, runner flow, schemas, adapter boundaries.
- `docs/protocol.md`: `classic_v1`, future `cross_exam_v1`, future `evidence_v1`.
- `docs/agent_interface.md`: agent creation, public/private cards, environment variables.
- `docs/judge_interface.md`: scoring schema and LLM-judge limitations.
- `docs/publishing.md`: ledger storage, index rebuild, site/archive publishing.

## Roadmap

- 0.1: Local deterministic debate runner.
- 0.2: Real SDK agents and judges.
- 0.3: Evidence-pack debates.
- 0.4: Cross-examination protocol.
- 0.5: Web debate mode with citations.
- 0.6: League ratings with Elo, then Glicko or TrueSkill.
- 0.7: Public hosted debate archive.
- 0.8: Private-agent submission protocol.

## Acceptance Criteria

Milestone 0.1 is complete only when current evidence proves:

- A public GitHub repository exists at the intended target or a recorded equivalent.
- A fresh clone can install dependencies.
- A user can run one stub debate locally.
- The debate produces transcript, JSONL, scorecard, judge votes, timing, tool log, match metadata, and ledger index artifacts.
- A user can inspect the generated transcript and scorecard.
- A user can rebuild the debate ledger.
- A user can replay a match.
- A simple leaderboard command works over the ledger.
- CI exists and passes for the deterministic path.
- At least one real SDK adapter exists or a clearly documented near-complete adapter exists with the blocker recorded.
- A first public-facing project page exists either on the site or as a website-ready artifact in this repo.
- No secrets, API keys, private prompts, or `.env` files are committed.
- `QUESTIONS.md`, `ASSUMPTIONS.md`, and `DECISIONS.md` record unresolved decisions and reversible assumptions.

## Open Questions To Track Separately

These should go into `QUESTIONS.md` during implementation rather than blocking progress:

- Should the website page land in `/Users/shimon/ws/shimmybezalel`, the older GitHub Pages repo, or only in Debate Club for now?
- Should the first real SDK adapter use OpenAI Agents SDK JS/TS, Anthropic Claude Agent SDK, or both later?
- What license should be used if no preference is given? The default implementation assumption is MIT.
- Should match artifacts from real model runs be committed by default, or only curated matches?
- Should agent cards reveal declared model families, or allow fully hidden model declarations in competitive settings?

## Self-Review Notes

This design is intentionally scoped to a CLI, schemas, deterministic local proof, optional SDK adapter, and publishable page. It does not require a hosted service, production website deployment, or complex tournament logic. The open ledger is represented as files so the project remains forkable, inspectable, and GitHub-native in the first milestone.
