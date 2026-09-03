# Daily Debate Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one low-cost, deterministic, evergreen Debate Club match per UTC day and deploy it from a durable Git-backed ledger without daily human work.

**Architecture:** A pure planner validates a versioned topic catalog and maps each UTC date to a topic, season, side assignment, and stable match ID. A daily runner composes existing loaders, adapters, match execution, artifact writing, and ledger rebuilding; a scheduled GitHub Actions workflow supplies the API secret only to that run, verifies all outputs, commits canonical artifacts, and deploys the generated static projection.

**Tech Stack:** TypeScript, Node.js 22, Vitest, Zod, YAML, OpenAI Agents SDK, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-03-daily-debate-growth-design.md`

## Global Constraints

- `matches/` remains the canonical database; generated `public-db/` and `viewer-dist/` directories are never committed by daily automation.
- Daily planning uses UTC dates and a fixed epoch of `2026-09-03`.
- The first catalog contains 96 append-only evergreen topics across eight allowed domains.
- Production daily defaults are `gpt-5.6-luna`, one judge, 260 debate output tokens, 700 judge output tokens, reasoning effort `none`, tracing disabled, response storage disabled, and no tools or web access.
- Existing match directories are never overwritten and an existing daily match causes zero API calls.
- The workflow never force-pushes and never retries model calls automatically.
- `OPENAI_API_KEY` is exposed only to the live daily-run step.
- Every task uses tests first and ends in a focused commit.

---

### Task 1: Modernize the Live Adapter and Close Dependency Findings

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types/core.ts`
- Modify: `src/schemas/cards.ts`
- Modify: `src/adapters/openaiAgentsSdk.ts`
- Modify: `tests/openaiAdapter.test.ts`

**Interfaces:**

- Consumes: existing `ModelConfig`, `LiveAdapterOptions`, and the Agents SDK `Agent` constructor.
- Produces: `ReasoningEffort`, `ModelConfig.reasoning_effort`, `LiveAdapterOptions.reasoningEffort`, and explicit `modelSettings.reasoning.effort` propagation.

- [ ] **Step 1: Add failing adapter tests**

Add a test-only exported helper contract to `tests/openaiAdapter.test.ts`:

```ts
import {
  resolveLiveModelConfig,
  type LiveAdapterOptions
} from "../src/adapters/openaiAgentsSdk.js";

it("uses the cost-controlled daily reasoning setting", () => {
  const options: LiveAdapterOptions = {
    model: "gpt-5.6-luna",
    reasoningEffort: "none"
  };
  expect(resolveLiveModelConfig(undefined, options, "agent")).toMatchObject({
    model: "gpt-5.6-luna",
    reasoning_effort: "none"
  });
});

it("lets an explicit card reasoning setting override the daily default", () => {
  expect(resolveLiveModelConfig(
    { reasoning_effort: "low" },
    { reasoningEffort: "none" },
    "judge"
  ).reasoning_effort).toBe("low");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/openaiAdapter.test.ts`

Expected: FAIL because `resolveLiveModelConfig` and reasoning-effort types do not exist.

- [ ] **Step 3: Upgrade dependencies and implement the model setting**

Run: `npm install @openai/agents@0.17.0 zod@4.5.4`

Add to `src/types/core.ts`:

```ts
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelConfig {
  model?: string;
  max_output_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  instructions_file?: string;
  tracing?: boolean;
  reasoning_effort?: ReasoningEffort;
}
```

Extend `modelConfigSchema` with the matching enum. Rename the private `resolveConfig` helper to exported `resolveLiveModelConfig`, give `LiveAdapterOptions` an optional `reasoningEffort`, and resolve `reasoning_effort` in this order: card, options, `DEBATECLUB_REASONING_EFFORT`, then `none`.

Pass this setting to the debate agent:

```ts
modelSettings: {
  maxTokens: Math.min(config.max_output_tokens, budget.max_tokens),
  temperature: config.temperature,
  reasoning: { effort: config.reasoning_effort },
  store: false,
  parallelToolCalls: false
}
```

Use `maxTokens: config.max_output_tokens` with the same remaining fields for the judge.

Include `reasoning_effort` in the materialized card metadata so each match records the configuration.

- [ ] **Step 4: Verify the adapter and dependency tree**

Run:

```bash
npm test -- tests/openaiAdapter.test.ts
npm run typecheck
npm audit --omit=dev
```

Expected: focused tests PASS, typecheck PASS, and production audit reports zero vulnerabilities.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/types/core.ts src/schemas/cards.ts src/adapters/openaiAgentsSdk.ts tests/openaiAdapter.test.ts
git commit -m "chore: modernize low-cost live adapter"
```

### Task 2: Add the Evergreen Catalog and Deterministic Daily Planner

**Files:**

- Create: `topics/evergreen-v1.yaml`
- Create: `src/daily/catalog.ts`
- Create: `src/daily/plan.ts`
- Create: `tests/dailyPlan.test.ts`
- Modify: `src/index.ts`

**Interfaces:**

- Produces: `loadEvergreenCatalog(path: string): Promise<Conjecture[]>`, `validateEvergreenCatalog(value: unknown): Conjecture[]`, `planDailyMatch(date: string, catalog: Conjecture[]): DailyMatchPlan`, and `dailyMatchId(date: string, season: number, conjectureId: string): string`.
- `DailyMatchPlan` is `{ date: string; dayIndex: number; season: number; topicIndex: number; matchId: string; conjecture: Conjecture; proAgent: "steelman-v1" | "cross-examiner-v1"; conAgent: "steelman-v1" | "cross-examiner-v1" }`.

- [ ] **Step 1: Write planner and catalog RED tests**

Create `tests/dailyPlan.test.ts` with these assertions:

```ts
it("maps the epoch to the first topic and first season", async () => {
  const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");
  const plan = planDailyMatch("2026-09-03", catalog);
  expect(plan).toMatchObject({
    date: "2026-09-03",
    dayIndex: 0,
    season: 1,
    topicIndex: 0,
    proAgent: "steelman-v1",
    conAgent: "cross-examiner-v1"
  });
  expect(plan.matchId).toMatch(/^daily-2026-09-03-s01-/);
});

it("starts season two after the 96-topic catalog", async () => {
  const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");
  expect(catalog).toHaveLength(96);
  expect(planDailyMatch("2026-12-08", catalog)).toMatchObject({
    dayIndex: 96,
    season: 2,
    topicIndex: 0
  });
});

it("alternates harness sides", async () => {
  const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");
  expect(planDailyMatch("2026-09-05", catalog)).toMatchObject({
    proAgent: "cross-examiner-v1",
    conAgent: "steelman-v1"
  });
});

it.each(["2026-09-03", "2026-02-30", "not-a-date"])(
  "rejects invalid or pre-epoch date %s",
  async (date) => {
    const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");
    expect(() => planDailyMatch(date, catalog)).toThrow();
  }
);

it("rejects duplicate topic ids", () => {
  const topic = validTopic("duplicate");
  expect(() => validateEvergreenCatalog([topic, topic])).toThrow(/duplicate/i);
});
```

Also assert that every catalog topic uses `no_external_info`, disables all tools, has 2–4 rubric notes, has a unique ID, and belongs to the eight-domain allowlist.

- [ ] **Step 2: Run the planner test and verify RED**

Run: `npm test -- tests/dailyPlan.test.ts`

Expected: FAIL because the daily modules and catalog do not exist.

- [ ] **Step 3: Implement the catalog loader and planner**

In `src/daily/catalog.ts`, parse YAML, validate with `z.array(conjectureSchema).length(96)`, enforce unique IDs, and enforce:

```ts
export const EVERGREEN_DOMAINS = [
  "ai_software_systems",
  "science_epistemology",
  "education_learning",
  "organizations_work",
  "technology_governance",
  "creativity_culture",
  "cities_environment",
  "philosophy_ethics"
] as const;
```

In `src/daily/plan.ts`, parse dates with a strict `YYYY-MM-DD` regex plus round-trip UTC component checks. Use integer UTC-day arithmetic from `Date.UTC(2026, 8, 4)`. Slugify topic IDs only by rejecting IDs outside `^[a-z0-9_]+$`; do not silently rewrite them.

The stable ID format is:

```ts
`daily-${date}-s${String(season).padStart(2, "0")}-${conjecture.id}`
```

- [ ] **Step 4: Create the 96-topic catalog**

Write twelve topics for each allowed domain. Every entry uses this full shape:

```yaml
- id: ai_open_standards_001
  statement: "Open standards matter more than model capability for the long-term health of agent ecosystems."
  domain: ai_software_systems
  truth_type: technical_design
  stance_mode: forced_random
  evidence_mode: no_external_info
  allowed_tools:
    web: false
    calculator: false
    evidence_pack: false
  background:
    short_context: "Compare ecosystem durability, interoperability, innovation speed, and the value of proprietary integration."
  rubric_notes:
    - distinguish present capability from long-term ecosystem structure
    - compare coordination benefits with constraints on experimentation
    - address migration costs and competitive differentiation
```

The 96 statements must be evergreen, balanced, self-contained, and free of named living people, elections, personal allegations, medical diagnoses, financial recommendations, protected-class generalizations, and wrongdoing instructions. Append domain groups in the exact order of `EVERGREEN_DOMAINS`; never sort or insert into an existing released catalog.

- [ ] **Step 5: Export and verify**

Export both daily modules from `src/index.ts`.

Run:

```bash
npm test -- tests/dailyPlan.test.ts
npm run typecheck
```

Expected: all daily planner tests PASS and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add topics/evergreen-v1.yaml src/daily/catalog.ts src/daily/plan.ts src/index.ts tests/dailyPlan.test.ts
git commit -m "feat: add evergreen daily debate planner"
```

### Task 3: Add Idempotent Daily Match Execution

**Files:**

- Create: `src/daily/runDaily.ts`
- Create: `tests/dailyRun.test.ts`
- Modify: `src/cli/main.ts`
- Modify: `tests/cli.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 2's `loadEvergreenCatalog` and `planDailyMatch`, plus existing protocol, agent, judge, runner, artifact, and ledger functions.
- Produces: `runDailyMatch(options: DailyRunOptions): Promise<DailyRunResult>` where `DailyRunResult` is `{ status: "created" | "exists"; plan: DailyMatchPlan; folder: string; ledgerMatches: number; winner?: DebateWinner }`.
- `DailyRunOptions` contains paths, date, `LiveAdapterOptions`, `judgeLimit`, and injectable `executeMatch` for zero-call idempotency tests.

- [ ] **Step 1: Write daily runner RED tests**

Create `tests/dailyRun.test.ts` with a temporary output directory and an injected deterministic match executor. Assert:

```ts
it("writes one planned match and rebuilds the ledger", async () => {
  const result = await runDailyMatch(testOptions("2026-09-04"));
  expect(result.status).toBe("created");
  expect(result.ledgerMatches).toBe(1);
  await expect(access(join(result.folder, "match.json"))).resolves.toBeUndefined();
  const index = JSON.parse(await readFile(join(output, "index.json"), "utf8"));
  expect(index.matches.map((match: { match_id: string }) => match.match_id))
    .toEqual([result.plan.matchId]);
});

it("performs zero match executions when the date already exists", async () => {
  const executeMatch = vi.fn(deterministicMatch);
  const options = testOptions("2026-09-04", executeMatch);
  await runDailyMatch(options);
  const second = await runDailyMatch(options);
  expect(second.status).toBe("exists");
  expect(executeMatch).toHaveBeenCalledTimes(1);
});
```

Add a CLI test that invokes `daily --date 2026-09-04 --dry-run --out <temp>` and expects `Daily match created`, then invokes it again and expects `already exists`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/dailyRun.test.ts tests/cli.test.ts`

Expected: FAIL because `runDailyMatch` and the `daily` command do not exist.

- [ ] **Step 3: Implement the daily service**

Implement `runDailyMatch` as composition only:

```ts
const catalog = await loadEvergreenCatalog(options.catalogPath);
const plan = planDailyMatch(options.date, catalog);
const folder = join(options.matchesRoot, plan.matchId);
if (existsSync(folder)) {
  const index = await rebuildLedgerIndex(options.matchesRoot);
  return { status: "exists", plan, folder, ledgerMatches: index.matches.length };
}
const protocol = protocolSchema.parse(await loadYamlFile(options.protocolPath));
const agents = {
  pro: await loadAgentFromDirectory(
    join(options.agentsRoot, plan.proAgent),
    options.adapterOptions
  ),
  con: await loadAgentFromDirectory(
    join(options.agentsRoot, plan.conAgent),
    options.adapterOptions
  )
};
const judges = await loadJudgePanel(options.judgesPath, {
  ...options.adapterOptions,
  judgeLimit: options.judgeLimit
});
const match = await (options.executeMatch ?? runMatch)({
  protocol,
  conjecture: plan.conjecture,
  agents,
  judges,
  matchId: plan.matchId
});
await writeMatchArtifacts(match, options.matchesRoot);
const index = await rebuildLedgerIndex(options.matchesRoot);
return {
  status: "created",
  plan,
  folder,
  ledgerMatches: index.matches.length,
  winner: match.result.winner
};
```

The existence check must happen before agent or judge loading so it precedes any provider object creation. `executeMatch` defaults to `runMatch` and is the only injected collaborator.

- [ ] **Step 4: Add the CLI command and package shortcut**

Add `debateclub daily` options:

```text
--date <YYYY-MM-DD>          defaults to current UTC date
--catalog <path>            defaults to topics/evergreen-v1.yaml
--protocol <path>           defaults to examples/protocols/classic_v1.yaml
--agents-root <path>        defaults to examples/agents
--judges <path>             defaults to examples/judges/panels/openai_epistemic_panel_v1
--out <path>                defaults to matches
--live | --dry-run
--model <model>
--judge-model <model>
--reasoning-effort <level>
--max-output-tokens <n>
--judge-max-output-tokens <n>
--timeout-ms <n>
```

Set command defaults to Luna, `none`, 260, 700, and one judge. Add `"daily:run": "tsx src/cli/main.ts daily"` to `package.json`.

- [ ] **Step 5: Verify daily dry-run behavior**

Run:

```bash
npm test -- tests/dailyRun.test.ts tests/cli.test.ts
temp_dir=$(mktemp -d)
npm run daily:run -- --date 2026-09-04 --dry-run --out "$temp_dir/matches"
npm run daily:run -- --date 2026-09-04 --dry-run --out "$temp_dir/matches"
```

Expected: tests PASS; first CLI run creates one match; second reports it already exists and the ledger remains at one match.

- [ ] **Step 6: Commit**

```bash
git add src/daily/runDaily.ts src/cli/main.ts tests/dailyRun.test.ts tests/cli.test.ts package.json package-lock.json
git commit -m "feat: run one idempotent daily match"
```

### Task 4: Make the Public Database a Generated Projection

**Files:**

- Modify: `.gitignore`
- Delete: tracked generated files under `public-db/`
- Modify: `README.md`
- Modify: `docs/publishing.md`
- Modify: `DECISIONS.md`
- Modify: `tests/publicDb.test.ts`

**Interfaces:**

- Consumes: existing `exportPublicDb`, `validatePublicDb`, and `buildViewer` functions.
- Produces: one canonical persistence rule: Git tracks `matches/`; projection commands rebuild `public-db/` and `viewer-dist/` on demand.

- [ ] **Step 1: Add a failing repository-storage assertion**

Extend `tests/publicDb.test.ts`:

```ts
it("keeps the public database a generated projection", async () => {
  const ignore = await readFile(".gitignore", "utf8");
  expect(ignore.split("\n")).toContain("public-db/");
  const { stdout } = await execFileAsync("git", ["ls-files", "public-db"]);
  expect(stdout.trim()).toBe("");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/publicDb.test.ts`

Expected: FAIL because `public-db/` is tracked and not ignored.

- [ ] **Step 3: Remove the duplicate projection from current tracking**

Add `public-db/` to `.gitignore`, then run:

```bash
git rm -r public-db
```

This removes the generated snapshot from the current tree; it remains recoverable from Git history and is regenerated by tests, Pages, and documented commands.

Update documentation so no text says the projection is committed. Add a dated decision explaining that daily ingestion made duplicate storage wasteful and that the viewer still embeds a complete generated DB.

- [ ] **Step 4: Verify projection completeness after cleanup**

Run:

```bash
npm test -- tests/publicDb.test.ts
npm run public-db:export
npm run public-db:validate
npm run viewer:build
git status --short
```

Expected: tests PASS; the ignored projection validates with all ledger matches; viewer builds; neither `public-db/` nor `viewer-dist/` appears as untracked output.

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md docs/publishing.md DECISIONS.md tests/publicDb.test.ts
git add -u public-db
git commit -m "refactor: generate public database from canonical ledger"
```

### Task 5: Schedule, Commit, and Deploy the Daily Match

**Files:**

- Create: `.github/workflows/daily-debate.yml`
- Create: `tests/dailyWorkflow.test.ts`
- Modify: `.github/workflows/pages.yml`
- Modify: `README.md`
- Modify: `docs/publishing.md`

**Interfaces:**

- Consumes: `npm run daily:run`, ledger/public DB/viewer scripts, `OPENAI_API_KEY`, GitHub's built-in token, and Pages deployment actions.
- Produces: a daily cron at `17 3 * * *`, manual dispatch with optional `date`, serialized execution, bot commit to `main`, and verified Pages deployment.

- [ ] **Step 1: Write workflow RED tests**

Create `tests/dailyWorkflow.test.ts`, parse the YAML with the existing `yaml` package, and assert:

```ts
expect(workflow.on.schedule).toEqual([{ cron: "17 3 * * *" }]);
expect(workflow.concurrency).toMatchObject({
  group: "daily-debate",
  "cancel-in-progress": false
});
expect(workflow.permissions).toMatchObject({
  contents: "write",
  pages: "write",
  "id-token": "write"
});
expect(serialized).toContain("npm run daily:run");
expect(serialized).toContain("secrets.OPENAI_API_KEY");
expect(serialized).toContain("npm run public-db:validate");
expect(serialized).toContain("git pull --rebase origin main");
expect(serialized).not.toContain("--force");
expect(serialized).toContain("actions/upload-pages-artifact@v4");
expect(serialized).toContain("actions/deploy-pages@v4");
```

Walk every step and assert that only the step whose name is `Run daily debate` has an `OPENAI_API_KEY` environment field.

- [ ] **Step 2: Run the workflow test and verify RED**

Run: `npm test -- tests/dailyWorkflow.test.ts`

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Implement the workflow**

Create `.github/workflows/daily-debate.yml` with:

- `schedule` at `17 3 * * *`
- `workflow_dispatch.inputs.date` as an optional string
- top-level `concurrency` exactly as tested
- top-level permissions exactly as tested
- `build` job on `ubuntu-latest`
- checkout and setup-node v5, Node 22, npm cache
- `npm ci`
- a `Run daily debate` step that derives `run_date` from the input or `date -u +%F`, writes it to `$GITHUB_OUTPUT`, and invokes:

```bash
npm run daily:run -- \
  --date "$run_date" \
  --live \
  --model gpt-5.6-luna \
  --judge-model gpt-5.6-luna \
  --reasoning-effort none \
  --max-output-tokens 260 \
  --judge-max-output-tokens 700 \
  --out matches
```

- typecheck, test, build, production audit, export, validate, and viewer build steps
- a commit step that stages only `matches/`, exits cleanly when there is no diff, commits as `github-actions[bot]`, pulls with rebase, and pushes `HEAD:main`
- Pages configuration and upload of `viewer-dist`
- a `deploy` job using the `github-pages` environment and `actions/deploy-pages@v4`

Update the ordinary Pages workflow to run `npm audit --omit=dev` before projection export so both publication paths share the dependency gate.

- [ ] **Step 4: Document operation and recovery**

Add to README and publishing docs:

- UTC schedule and topic-season behavior
- exact annual cost estimate assumptions
- required repository secret name
- manual recovery command using `workflow_dispatch` with the missed UTC date
- idempotency behavior
- rule that failed days are gaps unless explicitly replayed
- rule that provider failures are never committed as valid matches

- [ ] **Step 5: Verify the workflow and complete repository**

Run:

```bash
npm test -- tests/dailyWorkflow.test.ts
npm test
npm run typecheck
npm run build
npm audit --omit=dev
npm run public-db:export
npm run public-db:validate
npm run viewer:build
git diff --check
```

Expected: all tests PASS, typecheck/build PASS, production audit is clean, the projection validates, the viewer builds, and `git diff --check` is silent.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/daily-debate.yml .github/workflows/pages.yml tests/dailyWorkflow.test.ts README.md docs/publishing.md
git commit -m "ci: publish one low-cost debate daily"
```

### Task 6: Roll Out and Prove the First Public Daily Match

**Files:**

- No repository source edits expected.
- External state: repository secret, feature branch, pull request, `main`, workflow run, Pages deployment.

**Interfaces:**

- Consumes: a present local `OPENAI_API_KEY`, authenticated `gh` identity `ShimonBezalel`, and all Task 1–5 verification evidence.
- Produces: merged automation, encrypted repository secret, first bot-authored daily match, and a public viewer count increment.

- [ ] **Step 1: Verify authority and secret presence without printing values**

Run:

```bash
test "$(gh api user --jq .login)" = "ShimonBezalel"
test -n "${OPENAI_API_KEY:-}"
git status --short
```

Expected: identity matches, the environment check passes, and the worktree is clean.

- [ ] **Step 2: Run final local verification**

Run the full Task 5 verification block once more and record its exact pass counts and audit result.

- [ ] **Step 3: Store the encrypted repository secret**

Run:

```bash
gh secret set OPENAI_API_KEY --repo ShimonBezalel/debate-club --body "$OPENAI_API_KEY"
gh secret list --repo ShimonBezalel/debate-club | rg '^OPENAI_API_KEY\b'
```

Expected: only the secret name and updated timestamp are shown.

- [ ] **Step 4: Push, open, and merge the reviewed branch**

Run:

```bash
git push -u origin codex/daily-debate-growth
gh pr create --repo ShimonBezalel/debate-club --base main --head codex/daily-debate-growth --title "Publish one low-cost Debate Club match daily" --body-file docs/superpowers/specs/2026-09-03-daily-debate-growth-design.md
gh pr checks --repo ShimonBezalel/debate-club --watch
gh pr merge --repo ShimonBezalel/debate-club --squash --delete-branch
```

Expected: CI passes before the squash merge. If branch protection or CI blocks merging, preserve the branch and report the exact gate; do not bypass it.

- [ ] **Step 5: Dispatch the first daily run**

Use the current UTC date if it is on or after the epoch:

```bash
run_date=$(date -u +%F)
gh workflow run daily-debate.yml --repo ShimonBezalel/debate-club -f date="$run_date"
```

Watch the resulting run with `gh run watch`. Do not redispatch automatically on provider failure.

- [ ] **Step 6: Verify public state**

Verify:

- the workflow conclusion is `success`
- `main` contains exactly one `daily-<date>-...` match for the date
- its `match.json` records `gpt-5.6-luna`, reasoning effort `none`, and one judge
- the bot commit changed only canonical match ledger paths
- the Pages deployment succeeded
- the public `db/index.json` count is the old count plus one
- the public viewer renders the new conjecture, transcript, and scorecard
- no secret-shaped values appear in the commit, workflow logs, or public artifact

- [ ] **Step 7: Preserve rollout evidence**

Add the pull request URL, merge commit, daily workflow URL, bot match commit, Pages deployment URL, final match count, and estimated observed token cost to the final task report. No extra repository commit is required.
