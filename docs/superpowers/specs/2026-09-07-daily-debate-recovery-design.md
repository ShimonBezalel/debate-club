# Daily debate publication recovery — design

Date: 2026-09-07
Scope: bounded incident repair, explicitly delegated end to end by the repository owner.
Baseline: e4172beb8ec88fd9f98bc6d0e2a4f9b4cefe78f8.

## Problem and evidence

The September 7 scheduled Publish daily debate run 34099869778 successfully generated its match and passed typechecking, then failed in tests/cli.test.ts:29:3: "runs, rebuilds, replays, and summarizes a stub debate" exceeded Vitest's 5000 ms default. The remaining 47 tests passed. The September 6 run 34020376458 failed at the same deadline. September 5 run 33953181119 passed the same test in 4898 ms and 4828 ms on its two validation passes. Its only subsequent commit changed matches/ ledger data, not source, tests, dependencies, or workflow definitions.

This establishes a deadline-sensitive integration test. Runner startup/scheduling overhead is the leading explanation, not a proven breakdown of individual subprocess timings. The test launches four sequential npx/tsx CLI processes. It checks stub match creation, a one-entry index, replay, ledger rebuild, and leaderboard output. It is not a performance benchmark and does not call live models.

The build job failed before committing or pushing the generated match or uploading a Pages artifact. Deploy correctly remained skipped because it needs build. Do not bypass this dependency.

Evidence:
- https://github.com/ShimonBezalel/debate-club/actions/runs/34099869778/job/101671590173
- https://github.com/ShimonBezalel/debate-club/actions/runs/34020376458/job/101451724088
- https://github.com/ShimonBezalel/debate-club/actions/runs/33953181119/job/101271622226
- tests/cli.test.ts
- .github/workflows/daily-debate.yml
- https://vitest.dev/api/test

## Alternatives considered

1. Chosen: give only this four-process integration test a finite 15000 ms timeout. This is approximately three times the observed successful runtime; it creates startup headroom without changing assertions or behavior.
2. Raise the global timeout or add retries. Rejected: either changes unrelated tests' failure behavior or can hide recurring defects. An unchanged workflow rerun already has a demonstrated risk of repeating the incident and spending API usage again.
3. Refactor the CLI launcher, split the scenario, or redesign publishing to preserve generated artifacts. Potential follow-up work, but it introduces more moving parts than this incident requires. Do not bundle it into the recovery.

## Specification

- Change only the long integration test declaration in tests/cli.test.ts to pass { timeout: 15_000 }, with a comment explaining the four CLI startups.
- Preserve every existing assertion, command, fixture, match identifier, and temporary output directory.
- Keep the other CLI test and all other tests at their current timeouts. No skip, only, retry, global timeout, dependency, model, secret, or production-code changes.
- Leave all workflow files unchanged. Preserve both validation passes, the production audit, export/validation/viewer steps, non-forced canonical push, and needs: build.
- Reuse the existing failing behavior test as the regression test. Do not add a source-text assertion merely proving that a timeout literal exists.
- Keep changes on an isolated repair branch until the exact proposed revision passes CI. Use a PR for review and merge; do not force-update main.

## Verification and acceptance

1. Recheck baseline, workflow definitions, and latest run before mutation. Capture the historical failing test before changing it; request a fresh docs-only PR baseline run where possible. A passing baseline does not disprove an intermittent deadline failure.
2. Apply only the specified timeout change. Confirm the exact test-body diff is empty and all original assertions remain.
3. Run Node 22 / locked npm installation, typecheck, all 48 tests, and build on GitHub's runner. Require green CI on the exact proposed head before merging. Repeat the CLI/full suite where supported and retain all failures, not just the successful result.
4. If the same test reaches 15 seconds or an assertion fails, stop publication and investigate individual subprocess timing. Do not keep increasing the timeout.
5. Verify production audit, public DB export and validation, viewer build, and both test passes through the publication workflow. Success means the match is committed on main and the dependent Pages deployment is successful, not merely a queued rerun.

## Recovery safety

Prefer a fresh workflow_dispatch on main with date=2026-09-07. A same-day rerun is an acceptable fallback only after checking that the UTC date is still September 7, main contains the verified fix, no publication is active, and the expected match has not already been published. The existing workflow explicitly checks out main, so a rerun can pick up a test-only fix even though the event SHA remains the original SHA. Verify the actual checkout SHA and generation date in the rerun log.

The failed attempt did not persist its generated match. Regeneration can incur additional API usage and produce a different transcript. Do not restore invented output or use --force. Date-derived match-folder existence provides idempotence only for already persisted matches. Never rerun the September 6 scheduled event expecting a September 6 backfill: its empty input uses the UTC execution date. That separate backfill requires an explicit date dispatch.

If permissions, unavailable actions, or CI prevent completion, stop at the last verified stage and report exact branch/PR/run state. Never claim local tests ran when only CI ran, or claim a queued workflow succeeded.

## Deferred improvements

Separately consider a preflight before paid generation, validated recovery artifacts after generation, bounded subprocess lifetimes with diagnostic timing, and safe manual-date environment interpolation. None is necessary to weaken or bypass current publication gates, and none is included in this repair.
