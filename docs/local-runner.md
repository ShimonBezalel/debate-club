# Mac daily runner

The local runner preserves **03:17 UTC**, the existing `gpt-5.6-luna` recipe,
canonical `matches/` ledger and [public viewer](https://shimonbezalel.github.io/debate-club/).
Paid generation happens on the Mac; GitHub Pages still builds and deploys the viewer.

## Operating state

Migration is staged on October 3, 2026. The Mac service starts in **standby**
(`enabled: false`); the cloud daily schedule remains active until a real local
match, canonical push and public viewer entry are verified. Standby timer
invocations write a heartbeat and make no API calls.

October 1 is the last verified cloud success. October 2 and 3 failed with HTTP
429 and exhausted credits, before publishing ledger records. These two dates
remain missing until funding and an approved existing personal OpenAI credential
are available. The cloud secret's organization cannot be inferred from its name.
Moving hosts does not replenish credits. Never substitute a workplace key.

Ledger inspection also found an older missing date, September 6. Its historical
workflow failed during CLI testing after generation, as recorded in the
[September recovery design](superpowers/specs/2026-09-07-daily-debate-recovery-design.md).
No September 6 artifacts are published; explicit regeneration would incur fresh
API usage. Account for it separately from the October credit failures.

## Service and logs

The default private service directory is `~/Library/Application Support/DebateClub`.
It holds the copied runner, config, a separate Git checkout, secret files, a
kernel lock, heartbeat, date checkpoints and sanitized logs. It is outside Git
and private to the user (directory 0700; config/secrets/state 0600).

```bash
launchctl print system/com.shimon.debate-club.daily
tail -60 "$HOME/Library/Application Support/DebateClub/runner.log"
cat "$HOME/Library/Application Support/DebateClub/heartbeat.json"
```

`runner.log` rotates at 5 MB with five backups. `launchd.out.log` and
`launchd.err.log` contain only short outcomes. Date checkpoint files record
`generating`, `failed`, `generated`, `pushed`, or `verified`; no keys are stored
in checkpoints or logs. A verified timer tick makes no network/model calls.

The system LaunchDaemon runs as the normal user, checks every 60 seconds, and
starts when loaded. The UTC gate is unaffected by the Mac's local timezone or
DST. It handles the latest due UTC date after wake/restart, within a minute of
the next tick. Older missing dates require explicit recovery. A LaunchAgent
installation instead starts only at login. FileVault must be unlocked before
macOS can run a daemon; the service cannot turn on a shut-down Mac.

## Installation and updates

Use Python 3.9+, Node with the repository's locked dependencies, and `gh`.
Cloud CI uses Node 22; record the actual Mac version in cutover evidence.

```bash
python3 scripts/local_daily.py --stage-install daemon
sudo install -o root -g wheel -m 644 \
  "$HOME/Library/Application Support/DebateClub/com.shimon.debate-club.daily.plist" \
  /Library/LaunchDaemons/com.shimon.debate-club.daily.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.shimon.debate-club.daily.plist
```

For an update, unload the service before staging, then reload it. Staging
preserves existing config and credentials. Confirm the service is idle before
unloading; interrupting paid generation may require explicit recovery.

Config requires `key_file` and an approved `account` label for OpenAI; optional
`organization` and `project` select explicit scope. Secret files contain one raw
existing credential. Ambient shell keys, provider endpoints and debug settings
are discarded. The API key is passed only to the live daily child, never npm
validation or GitHub operations. `github_token_file` pins the existing personal
GitHub credential and avoids dependency on an unlocked login Keychain after
restart; it grants no new permissions. Keep all secret locators local.

## Recovery and duplicate protection

### Hobby spending limit

The Mac runner uses a **$5 working ceiling per UTC calendar month**; config
`monthly_budget_usd` can be lowered, and values above **$10 are rejected**.
Before each new paid attempt it durably reserves **$0.10** in private
`spend-YYYY-MM.json`. Failed/interrupted attempts and explicit retries retain
their reservations. Backfills count against the month in which generation
actually executes; resuming completed artifacts makes no new reservation.
The kernel writer lock serializes budget checks, and reaching the ceiling stops
generation before any provider call. Never delete the spend book to bypass a cap.

The fixed recipe uses seven calls, at most 2,260 output tokens in total, and
a 16,000-byte instructions/input limit per call. At the
[current GPT-5.6 Luna pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
($0.20/M input, $0.02/M cached input, $0.25/M cache writes and $1.20/M output),
the $0.10 reservation gives substantial input/framing headroom. It is a
conservative allocation, **not an invoice total**. Review pricing and the reserve
before changing the model, call count, caps, tools or prompt guard. This covers
the local wrapper, not unrelated API usage or direct CLI/cloud generation;
use this wrapper for hobby recovery. The provider's billing page is authoritative
for actual account charges. No credits are purchased automatically.

Local processes share a kernel lock; model/build children retain that lock if
the wrapper crashes. Cloud and local publishers also acquire the atomic GitHub
ref `refs/heads/debate-club-daily-lock`. No model call starts without the shared
lease. Different owners cannot remove each other's lease. The Mac can recover
its own interrupted lease while holding the local kernel lock. A stale cloud
lease requires checking its recorded workflow run is finished before explicitly
releasing that owner's lease. Never delete an active lock.

Generation failure or an interruption before completed artifacts is not
automatically retried. Completed artifacts survive later validation, push or
deployment failure and resume without model calls. Publication failures have a
one-hour cooldown; manual `--recover` overrides it. Unexpected checkout edits,
another pending date, incomplete artifacts and rebase conflicts stop safely.
Do not reset the publication checkout or force-push.

After restart, older retained completed output is published before starting the
latest due date. Older failed generations without completed output stay manual.

After funding is available, use the same explicit date contract as the existing
documented cloud recovery. The wrapper fetches the remote ledger first and
skips generation for an existing complete date. It validates before committing,
rebases and revalidates before pushing, waits for successful Pages deployment,
and checks the public `db/matches.json` for the match.

```bash
python3 "$HOME/Library/Application Support/DebateClub/local_daily.py" \
  --config "$HOME/Library/Application Support/DebateClub/config.json" \
  --date 2026-10-02 --recover
# Repeat with --date 2026-10-03; check the first date is verified first.
```

`--check --date 2026-10-01` runs preflight in the isolated checkout without model
calls, commits, pushes or deployment. It does not prove paid generation works.
Use only complete live records for publication; dry-run artifacts are rejected.

Cloud manual recovery remains available:

```bash
gh workflow run daily-debate.yml --repo ShimonBezalel/debate-club -f date=YYYY-MM-DD
```

Ensure the cloud secret belongs to the approved account before using this path.
Set the Mac to standby for planned cloud recovery. Shared locking still prevents
simultaneous writers; stable match IDs prevent duplicate published entries.

## Cutover and rollback

Keep `enabled: false` until a real local live date is `verified`, its match is
on remote `main`, Pages succeeded and the public viewer includes it. Then remove
only `on.schedule` from `daily-debate.yml` on `main`, retaining dispatch and all
publication checks. Update the workflow schedule test to assert that dispatch
remains and schedule is absent. Confirm no queued cloud daily run remains, then
set local config `enabled: true`. Observe a launchd invocation and the heartbeat.

Rollback: set local `enabled: false`, wait for the local writer to exit, then
restore the cloud `schedule: [{cron: "17 3 * * *"}]` in a validated Git change.
Keep manual dispatch available throughout. Verify that the cloud API secret has
the approved account and funding before recovery. Existing dates remain
idempotent; never rerun an old scheduled event expecting a backfill because an
empty workflow input uses the UTC execution date.

Reuse review: date planning, match execution, validation, projection and Pages
are reused. Python stdlib owns only host scheduling, durable checkpoints and
coordination; no new package dependencies or billing changes. Review is a
self-review under the owner's no-subagent instruction.
