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

`matches/` remains canonical. `public-db/` is the deterministic, viewer-oriented projection. `viewer-dist/` is generated deployment output and is not committed.

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
