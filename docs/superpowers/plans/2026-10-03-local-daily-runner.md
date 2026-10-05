# Local daily runner implementation plan

Goal: preserve the 03:17 UTC publication, ledger and viewer while moving paid execution to this Mac. The owner explicitly requests inline TDD implementation, no subagents, and no intermediate approval gates.

Reuse: keep the date planner, daily CLI, locked npm dependencies, verification commands and existing Pages deployment. Add only a stdlib Python operational wrapper and launchd installation; do not add a queue, database, provider or credential registry. Self-review is used because independent agents are prohibited.

- [x] Add failing tests for UTC due dates, local process locking, secret isolation, failed-attempt suppression, resume after completed generation, cloud activity checks and publication verification.
- [x] Implement `scripts/local_daily.py`: private config/state/logs, a separate checkout, bounded subprocesses, preflight, date-specific live generation, validation, non-forced push and verification of Pages and its public index. Never publish dry-run output. Scheduled work stays in standby until verified cutover.
- [x] Test incomplete-match handling, then make daily artifacts atomic so a process interruption cannot make an incomplete directory look published.
- [x] Add and test launchd plist generation and installation. Verify load, timer, repeated invocation and service reload. The owner supplied administrator authentication; a system daemon was installed running as the normal user. A real machine reboot has not been performed. FileVault remains enabled.
- [x] Verify a real live publication with the existing provider/account once its credential locator and funding are established. Recover October 2 and 3 explicitly, checking remote ledger first.
- [x] Only after verified live local publication, remove the cloud `schedule` event while retaining workflow dispatch, validation and Pages. Verify the default branch and enable local scheduled live execution.
- [x] Document logs, missed dates, manual recovery, reboot limitations, cutover evidence and rollback. Run full validation and self-review.

Failure cases: do not retry paid failures automatically; retain completed artifacts after validation/network/deploy failure; stop on non-ledger dirt or conflicting remote records; require explicit credential provenance; never force-push. The system daemon starts independently of GUI login after the FileVault volume is unlocked. AC sleep is already disabled on this Mac; no power/security setting changes are included.

Self-review added regression coverage for the existing public projection (`index.json` points to `matches.json`), Git porcelain whitespace, explicit GitHub file credentials after restart, pending records from another date, sanitized logs and child process termination. The remote ledger also lacks September 6; its historical test failure is documented separately from the October funding incident. The agent created no provider accounts or credentials; the user supplied the personal key.

Restart selection reuses date checkpoints to finish older completed paid output before attempting the latest due date. Failed generations without completed artifacts remain manual; no automatic paid backfill is introduced.

Verified cutover on October 5: PR #6 selected GPT-6 Luna and installed the $5 working/$10 absolute local allocation guard. September 6 and October 2–4 were explicitly recovered and verified in Pages; October 5 was generated and published by the actual system LaunchDaemon. PR #7 removed only cloud cron after the first live publication. Reload then returned done without changing the match or allocation. Cloud manual dispatch on existing October 5 succeeded with no model calls. There are 46 archive entries and no missing daily dates through October 5. No full Mac reboot was performed.
