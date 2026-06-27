# Debate Club Public Database

This directory is a static, open-source database of valid Debate Club matches. It is generated from the canonical `matches/` ledger so anyone can fork, diff, cite, and replay the public artifacts without relying on a hosted database.

- Schema version: 1.0
- Matches: 13
- Ledger through: 2026-06-27T11:23:24.944Z
- Source project: https://github.com/ShimonBezalel/debate-club

## Schema

| Path | Contents |
| --- | --- |
| `index.json` | Database manifest, schema version, ledger timestamp, and aggregate file paths. |
| `matches.json` | Searchable match summaries for viewers and indexes. |
| `agents.json` | Public agent metadata and match participation. |
| `judges.json` | Public judge metadata, models, matches, and vote counts. |
| `conjectures.json` | Conjecture catalog with domains, truth types, and match IDs. |
| `matches/<match-id>.json` | Complete canonical match object plus public artifact links. |
| `matches/<match-id>.transcript.md` | Human-readable transcript. |
| `matches/<match-id>.scorecard.md` | Human-readable result and judge summary. |

## Use

Serve this directory as static files or consume it directly from a local clone. Start with `index.json`, load `matches.json` for discovery, then open the per-match JSON or Markdown artifacts.

Regenerate and validate:

```bash
npm run cli -- ledger export-public-db --matches matches --out public-db
npm run cli -- ledger validate-public-db --db public-db
```

When citing a match, use its stable `match_id`, source repository folder, and `created_at` timestamp.
