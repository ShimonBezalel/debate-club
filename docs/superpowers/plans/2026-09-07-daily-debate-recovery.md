# Daily Debate Recovery Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans and superpowers:test-driven-development. Use verification-before-completion before merge or success claims.

**Goal:** Restore publication by repairing the evidenced integration-test deadline without bypassing any validation gate.

**Architecture:** Keep production code and all workflows unchanged. Use the existing failing four-command CLI scenario as the regression, apply a test-local finite timeout, and validate through an isolated branch and GitHub Actions before publication.

**Tech Stack:** TypeScript, Node 22, npm lockfile, Vitest 4, GitHub Actions, GitHub Pages.

**Spec:** docs/superpowers/specs/2026-09-07-daily-debate-recovery-design.md

## Global constraints

- Only the long CLI integration test receives timeout: 15_000.
- Preserve all assertions, fixture inputs, and commands.
- No global timeout, retries, skipped tests, dependency updates, secret changes, production changes, workflow edits, or force pushes.
- Both existing publication validation passes and needs: build remain mandatory.
- Local networking may be unavailable; GitHub Actions is then the execution environment, not a substitute claim that local tests passed.

## Task 1: Establish the red baseline and review the design

**Files:** Create this plan and its spec; read tests/cli.test.ts and the three existing workflow files.

- [ ] Recheck main and active runs. Expected baseline: e4172beb8ec88fd9f98bc6d0e2a4f9b4cefe78f8, unless another actor has advanced it.
- [ ] Create an isolated repair branch from the checked baseline with documentation only; open a draft PR to main. This requests existing CI without live generation or deployment.
- [ ] Inspect its run and logs. The regression is the unchanged test named "runs, rebuilds, replays, and summarizes a stub debate". Expected intermittent failure: Test timed out in 5000ms, tests/cli.test.ts:29:3. Historical red evidence is run 34099869778/job/101671590173 and run 34020376458/job/101451724088. Record a fresh pass honestly if the runner is faster; do not manufacture a failing assertion.
- [ ] Check the spec for scope, missing acceptance criteria, and inconsistent recovery dates before implementation.

## Task 2: Apply and verify the smallest fix

**Modify:** tests/cli.test.ts, long test declaration only.
**Test:** existing tests/cli.test.ts; full 48-test suite.

- [ ] Replace the declaration exactly:

```ts
  // Four CLI process launches need CI startup headroom.
  it("runs, rebuilds, replays, and summarizes a stub debate", { timeout: 15_000 }, async () => {
```

- [ ] Confirm the remaining test file is byte-for-byte unchanged relative to baseline. In particular, preserve the assertions for match creation, one-entry index, replay, rebuild, and leaderboard.
- [ ] Commit with message: fix: allow CI startup headroom for CLI integration test.
- [ ] Inspect CI for this exact PR head. Existing CI runs:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

- [ ] Require every step and all 48 tests to pass; capture the long test duration. Repeat using an available CI rerun operation, or locally when dependencies are available:

```sh
set -e
for i in 1 2 3 4 5; do
  npm test -- tests/cli.test.ts --reporter=verbose
done
```

- [ ] If a subprocess hangs or any assertion fails, stop and investigate; do not increase the timeout again or add retries.
- [ ] Review both specification compliance and code quality. No independent reviewer should be claimed unless one actually ran. Inspect the final PR diff and exact-head CI before merge.

## Task 3: Merge safely and recover September 7 publication

**Changes:** normal PR merge and at most one publication attempt after all preconditions pass.

- [ ] Re-read main, the PR mergeability state, and CI. Merge only the reviewed head without bypassing required checks; if main moved, re-evaluate the merge result.
- [ ] Confirm main contains the timeout fix, the expected daily match is absent, and no daily publication is active.
- [ ] Prefer explicit-date dispatch:

```sh
gh workflow run daily-debate.yml -R ShimonBezalel/debate-club --ref main -f date=2026-09-07
```

- [ ] If dispatch is unavailable, a same-day rerun may be used only while UTC date is 2026-09-07. Keep .github/workflows/daily-debate.yml unchanged. Use the failed-jobs rerun operation for run 34099869778, then verify the log checks out the fixed main revision and uses --date 2026-09-07. Do not run this fallback on another UTC date.
- [ ] Observe completion. Require successful generation/idempotent existing match, initial tests, production audit, public DB export/validation, viewer build, post-rebase reverification, non-forced push, artifact upload, and dependent deploy.
- [ ] Fetch main and verify matches/daily-2026-09-07-s01-ai_deterministic_replay_005/match.json and index membership. Record the final run attempt and deployment conclusion.
- [ ] Report spec/plan, exact diff, red/green evidence, PR/merge SHA, and publication result. Any permission or execution blocker remains explicitly unfinished. September 6 recovery is separate and requires date=2026-09-06; never pretend a same-day scheduled rerun backfills it.
