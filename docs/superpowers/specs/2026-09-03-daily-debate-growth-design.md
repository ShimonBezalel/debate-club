# Daily Debate Growth Design

## Objective

Grow Debate Club by one public, inspectable match per day with low operating cost, no daily human intervention, a durable source of truth, and a topic policy suitable for a project that is becoming part of a public professional identity.

## Context

Debate Club already has the important storage boundary in place:

- `matches/` is an append-only, Git-backed ledger of complete match artifacts.
- `public-db/` is a deterministic browser projection.
- `viewer-dist/` is a generated GitHub Pages artifact.
- The existing live path makes seven or eight model calls per match and has averaged about 8,832 input tokens and 2,033 output tokens.
- The public repository has no `OPENAI_API_KEY` secret today.
- GitHub Models cannot provide a free inference path because GitHub retired that service on 2026-07-30.

The current public corpus is technically coherent but topically narrow: most live conjectures debate Debate Club's own architecture. Daily growth should broaden the subject matter without turning the project into an unsupervised breaking-news publisher.

## Options Considered

### 1. Daily scheduled match over a curated rotating catalog — selected

A GitHub Actions workflow selects a topic deterministically from a reviewed evergreen catalog, runs one low-cost match, validates it, appends it to the ledger, and deploys the rebuilt viewer. Once the catalog is exhausted, a new season begins and the same topics are revisited with current agents and model metadata.

This has the lowest reputational and operational risk. Repeated topics are analytically useful because the artifacts preserve model, agent, prompt, date, usage, and result metadata.

### 2. Daily generated or news-derived topic

A model or feed chooses a new topic each day. This improves novelty but adds source drift, an extra inference step, moderation burden, and the possibility of auto-publishing a poorly framed claim about a live controversy or person.

This is deferred until Debate Club supports evidence packets, citations, topic review states, and stronger publication policy.

### 3. Monthly batch generation with daily release

A local or opportunistic compute job creates a month of matches at once, and a cheap scheduler publishes one each day. It minimizes daily API orchestration but creates a single point of failure and makes publication dates misleading unless the distinction between run date and release date is added to the schema.

This is not selected.

## Architecture

### Daily planner

A new pure module maps a UTC date to a daily plan:

1. Count whole days from a fixed epoch.
2. Select `dayIndex % catalogLength`.
3. Set `season = floor(dayIndex / catalogLength) + 1`.
4. Alternate the two agent harnesses between pro and con to reduce persistent side/harness bias.
5. Create a stable match ID from the date, season, and conjecture ID.

The plan is deterministic, independently testable, and idempotent. A date whose match directory already exists performs no API calls.

### Topic catalog

The catalog is versioned data, not model output. It contains evergreen, self-contained conjectures in domains such as:

- AI and software systems
- science and epistemology
- education and learning
- organizations and work
- technology governance
- creativity and culture
- cities, infrastructure, and environment
- philosophy and everyday ethics

Catalog rules:

- Use `no_external_info`; no claim should require today's news or browsing.
- Avoid named living people, electoral advocacy, personal allegations, medical diagnosis, financial recommendations, protected-class generalizations, and instructions for wrongdoing.
- Prefer propositions with meaningful arguments on both sides.
- Include explicit rubric notes that identify the core trade-offs.
- Keep IDs stable forever. Editing a statement requires a new ID.
- Repetition in later seasons is intentional and visible.

The first catalog should cover at least one quarter of daily runs. Future catalog additions do not alter the date mapping for already published matches because the match ID and full conjecture are stored in each artifact. To keep future scheduling stable, new topics are appended rather than inserted or reordered.

### Match execution

The daily command reuses the existing runner, adapters, artifact writer, and ledger rebuild. Its production defaults are deliberately small:

- model: `gpt-5.6-luna`
- one public judge
- six debate turns under the existing `classic_v1` protocol
- 260 maximum output tokens per debate turn
- 700 maximum output tokens for the structured judge response
- tracing and provider response storage disabled
- no tools and no web access

At the current corpus's average usage, GPT-5.6 Luna's published rates imply about $0.004 per match, or roughly $1.50 per year. This is an estimate, not a billing guarantee. The model and caps remain explicit workflow inputs so they can be changed without rewriting historical artifacts.

### Scheduled workflow

A dedicated workflow runs once daily at an off-peak UTC minute and can also be dispatched manually for recovery. It:

1. Checks out `main` with content-write and Pages-deploy permissions.
2. Installs locked dependencies.
3. Runs the daily match for the current UTC date with `OPENAI_API_KEY` scoped only to that step.
4. Runs typecheck, tests, build, public DB export/validation, and viewer build.
5. Commits only canonical ledger changes (`matches/<id>`, `matches/index.json`, and `matches/README.md`) using the GitHub Actions bot identity.
6. Rebases on the latest `main` and pushes. A conflict fails closed; it never force-pushes.
7. Uploads and deploys the already-verified viewer artifact.

The workflow does not automatically retry model calls. That prevents a partial provider outage from multiplying spend. A manual rerun for the same date is safe because existence is checked before calling the API.

Commits made with the built-in `GITHUB_TOKEN` do not reliably trigger follow-on workflows, so this workflow owns validation and Pages deployment for its generated match rather than depending on the ordinary push workflows.

### Storage

`matches/` remains the canonical database. No hosted SQL service is introduced.

The checked-in `public-db/` snapshot is removed from the active storage path and ignored. It duplicates most match content and would otherwise amplify daily Git growth. The Pages workflow and local commands continue to generate it into a temporary or ignored directory. The existing public viewer remains unchanged because it serves the generated projection in `viewer-dist/db/`.

At the current artifact size, one match per day is on the order of tens of megabytes per year, which is appropriate for a Git-backed corpus. A hosted index becomes justified only when repository clone size, query latency, or multi-writer ingestion becomes a measured problem. Even then, Git artifacts remain canonical and the hosted database is a rebuildable cache.

## Data Integrity and Failure Handling

- Refuse invalid dates and dates before the epoch.
- Validate the complete catalog at startup; reject duplicate IDs or unsafe mutation of required fields.
- Refuse to overwrite an existing match directory.
- Write match artifacts only after all turns and judge calls complete.
- Keep failed provider runs out of the valid ledger.
- Rebuild the ledger deterministically after a successful write.
- Validate the public projection before committing or deploying.
- Use workflow concurrency so two daily writers cannot run simultaneously.
- Never force-push and never commit generated `public-db/` or `viewer-dist/` output.
- Record model and token usage already present in match artifacts for later cost analysis.

## Dependency and Security Maintenance

The current production dependency tree contains known vulnerabilities through the older Agents SDK. Upgrade `@openai/agents` and compatible locked transitive dependencies before enabling the scheduled workflow, then require a clean production audit in CI and the daily workflow.

The API key is stored only as the encrypted repository secret `OPENAI_API_KEY`. It is never printed, written to an artifact, exposed to pull requests from forks, or made available to build/test steps that do not require it.

## Testing

Add tests before implementation for:

- deterministic date-to-topic/season mapping
- append-only catalog ordering and duplicate-ID rejection
- agent-side alternation
- stable match IDs
- invalid date and pre-epoch rejection
- existing-match idempotency with zero runner invocation
- daily dry-run writing one valid match and rebuilding the ledger
- workflow structure: schedule, concurrency, permissions, secret scoping, validation, non-force push, and Pages deployment
- generated public DB remaining complete after the storage change

Final verification includes the full test suite, typecheck, build, production dependency audit, public DB export/validation, viewer build, workflow YAML parsing, and one local daily dry-run in a temporary directory.

## Rollout

1. Land the planner, catalog, CLI command, workflow, storage cleanup, tests, and documentation on a feature branch.
2. Add the existing local OpenAI project key as the encrypted repository secret without exposing its value.
3. Push the branch, open a pull request, and require CI to pass.
4. Merge to `main`.
5. Dispatch the workflow once for the current UTC date.
6. Verify the bot-authored match commit, public archive count, Pages deployment, and public match rendering.

If the first live run fails because GPT-5.6 Luna is not enabled for the API project, the workflow remains safe and no ledger artifact is committed. The fallback is the cheapest enabled model that supports structured outputs; it must be selected explicitly and documented before redispatch.

## Deferred Work

- Live-news or web-cited debates
- Model-generated topics
- Evidence packet ingestion
- Human topic submissions and moderation queues
- Hosted SQL or vector indexes
- Ratings across changing model/agent versions
- Automatic social posting

These become sensible only after the daily evergreen lane has produced enough data to expose real needs.
