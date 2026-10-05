# Mac daily runner

**Active since October 5, 2026.** The Mac system LaunchDaemon publishes at
**03:17 UTC**, using `gpt-6-luna` for both debaters and the public judge, reasoning
`none`, six 260-token turn caps and one 700-token judge cap. GitHub Pages still
deploys the [public viewer](https://shimonbezalel.github.io/debate-club/).
`matches/` stays canonical; generated public DB/viewer outputs remain untracked.

## Verified cutover

- A new September 6 match was generated locally and verified in Pages before
  [PR #7](https://github.com/ShimonBezalel/debate-club/pull/7) removed **only** the
  cloud daily cron. Date-specific cloud manual dispatch remains available.
- September 6 and October 2–4 were recovered explicitly. October 5 was generated,
  pushed and verified by the actual system LaunchDaemon. All five use GPT-6 Luna.
  The archive has 46 entries, with no missing daily date from September 3 through
  October 5 and no duplicate date-based entry.
- October 2–4 originally failed with exhausted API credits. September 6's earlier
  test failure is recorded in the [recovery design](superpowers/specs/2026-09-07-daily-debate-recovery-design.md).
  Backfill IDs preserve intended UTC dates; creation timestamps record when
  generation actually occurred.
- Service reload preserved the published October 5 match and monthly allocation.
  Cloud manual dispatch on that existing date succeeded with no model calls.
  No full machine reboot was performed. Tested Mac runtime: Node 25.8.1 and
  Python 3.10; cloud CI uses Node 22.

## Status and logs

The private directory is `~/Library/Application Support/DebateClub`: config,
copied runtime, isolated publication checkout, heartbeat, date checkpoints,
kernel lock, spend books and sanitized logs. Directory mode is 0700;
config, secrets and state are 0600. API credentials and locators stay outside Git.

```bash
launchctl print system/com.shimon.debate-club.daily
cat "$HOME/Library/Application Support/DebateClub/heartbeat.json"
tail -60 "$HOME/Library/Application Support/DebateClub/runner.log"
```

`runner.log` rotates at 5 MB with five backups; launchd output/error logs contain
short outcomes. An idle service normally shows `not running`, last exit code 0
and a 60-second interval. Check the heartbeat for a recent UTC time and outcome.
The UTC gate preserves the schedule across DST. Startup/wake checks the latest
due date; older completed output resumes first. FileVault must be unlocked before
macOS can run the daemon. The service cannot turn on a shut-down Mac.

## Recovery

```bash
python3 "$HOME/Library/Application Support/DebateClub/local_daily.py" \
  --config "$HOME/Library/Application Support/DebateClub/config.json" \
  --date YYYY-MM-DD --recover
```

The wrapper fetches the remote ledger first. Existing complete dates make no
model calls. Failed/interrupted generation requires explicit `--recover` and may
incur fresh usage. Completed artifacts survive later failures and resume without
regeneration; publication retries have a one-hour cooldown. `--check` validates
without generation, commit, push or deployment.

Do not reset this checkout or force-push. Unexpected edits, another pending date,
incomplete artifacts or rebase conflicts stop publication for inspection. Local
children retain the kernel lock if the wrapper crashes. Cloud/local writers also
share `refs/heads/debate-club-daily-lock`; never remove an active lease. The Mac
reclaims its own interrupted lease under the kernel lock. A stale cloud lease
needs its recorded workflow run confirmed terminal before explicit release.

Cloud recovery remains:
`gh workflow run daily-debate.yml --repo ShimonBezalel/debate-club -f date=YYYY-MM-DD`.
Put the Mac in standby for planned cloud recovery. A **new** cloud date also needs
its repository secret to belong to the approved funded account; that secret was
not replaced during migration. Existing-date cloud recovery was verified.

## Hobby budget and credentials

The local monthly working limit is **$5**; `monthly_budget_usd` above **$10** is
rejected. Every new paid attempt reserves **$0.10** durably in `spend-YYYY-MM.json`.
Failures, interruptions and explicit retries retain allocations. Backfills use
the execution month; resuming completed output adds no allocation. Never delete
a spend book to bypass a limit. October starts with a conservative $0.50 allowance
for five earlier known attempts, including failures.

The live instructions/input cap is 16,000 UTF-8 bytes per call. The seven-call
recipe and current [GPT-6 Luna prices](https://developers.openai.com/api/docs/models/gpt-6-luna)
leave headroom inside the reservation. This is not an invoice or account-wide
cap: direct CLI/cloud runs and unrelated API usage are outside it. Use the wrapper
for hobby recovery. Review prices and allocation before changing model, caps,
call count or tools. No credits are bought automatically.

Private config selects the approved personal OpenAI account and explicit key
file; ambient API keys, scope and endpoints are discarded. Only the live child
receives the provider key. `github_token_file` pins an existing personal GitHub
credential so restart recovery does not depend on an unlocked login Keychain.

## Updates and rollback

Wait for the writer to finish, unload, stage the tested runtime, then install
and reload it. Staging preserves private config.

```bash
sudo launchctl bootout system/com.shimon.debate-club.daily
python3 scripts/local_daily.py --stage-install daemon
sudo install -o root -g wheel -m 644 \
  "$HOME/Library/Application Support/DebateClub/com.shimon.debate-club.daily.plist" \
  /Library/LaunchDaemons/com.shimon.debate-club.daily.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.shimon.debate-club.daily.plist
```

**Rollback:** set private config `enabled: false`, wait for any writer to finish,
and revert cutover commit `744b9d3` through a validated Git change. That restores
`17 3 * * *` and its workflow test while retaining manual dispatch. Confirm the
cloud secret's account/funding before live recovery. Never rerun an old scheduled
event expecting a backfill: empty input uses the UTC execution date.

Reuse review: existing date planning, match execution, checks, projection and
Pages are retained. Python stdlib adds host scheduling, private atomic state and
coordination without package dependencies. Review was a self-review under the
owner's no-subagent instruction.
