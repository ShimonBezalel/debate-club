# Publishing

Debate Club treats every completed match as a publishable artifact.

## Ledger Files

Each match directory contains:

- `match.json`
- `transcript.md`
- `transcript.jsonl`
- `judge_votes.json`
- `scorecard.md`
- `timing.json`
- `tool_log.json`

`matches/index.json` is rebuilt from match folders:

```bash
npm run cli -- ledger rebuild --matches matches
```

The same command also updates `matches/README.md`, a human-readable archive table with transcript and scorecard links.

## Static Public Database

```bash
npm run cli -- ledger export-public-db --matches matches --out public-db
npm run cli -- ledger validate-public-db --db public-db
npm run cli -- viewer build --db public-db --out viewer-dist
```

`matches/` remains canonical. `public-db/` is the deterministic, viewer-oriented projection. Both `public-db/` and `viewer-dist/` are generated deployment outputs and are not committed. The projection can always be recreated from a clone that contains the ledger.

## Daily Publication

`.github/workflows/daily-debate.yml` runs at 03:17 UTC and accepts an optional `YYYY-MM-DD` input for manual recovery. The date deterministically selects a topic, season, match ID, and alternating agent-side assignment from `topics/evergreen-v1.yaml`.

The live step alone receives the encrypted `OPENAI_API_KEY` repository secret. It runs one `gpt-5.6-luna` match with six 260-token debate caps, one 700-token judge cap, reasoning effort `none`, and no automatic retry. Provider failure therefore creates a visible gap rather than multiplying spend or committing an incomplete record.

After a complete match, the workflow:

1. Rebuilds `matches/index.json` and `matches/README.md`.
2. Runs typecheck, tests, build, and the production dependency audit.
3. Regenerates and validates `public-db/` and builds `viewer-dist/`.
4. Commits only `matches/` with the GitHub Actions bot identity.
5. Rebases without force-pushing, repeats verification on the rebased tree, and pushes to `main`.
6. Deploys the verified viewer artifact to GitHub Pages.

Commits made with the built-in workflow token do not serve as a dependency for another workflow; the daily workflow owns its own validation and Pages deployment.

Manual recovery:

```bash
gh workflow run daily-debate.yml --repo ShimonBezalel/debate-club -f date=YYYY-MM-DD
```

The command is idempotent. If the stable date-based match directory already exists, no model calls occur and no match file is rewritten.

## Quickstart Commands

```bash
npm install
npm run cli -- run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/ai_tutors_homework_001.yaml --pro examples/agents/stub_pro --con examples/agents/stub_con --judges examples/judges/stub_panel --out matches --match-id local-ai-tutors-stub
npm run cli -- replay matches/local-ai-tutors-stub
npm run cli -- ledger rebuild --matches matches
npm run cli -- leaderboard matches
```

## Website Page

The real Astro website page lives in `/Users/shimon/ws/shimmybezalel/src/pages/projects/debate-club.astro`. Production publication should happen through a reviewed site change and a clean build.
