# Decisions

## 2026-06-27: Use MIT License For Milestone 0.1

The project starts under MIT because the approved design calls for a permissive open-source repository and no alternative license preference has been supplied. This can be changed before the first public release if needed.

## 2026-06-27: Commit One Curated Stub Match

Milestone 0.1 commits one deterministic stub match so new users can inspect the ledger shape without spending API tokens. Real model match artifacts should be curated before commit because transcripts can contain private prompts, sensitive source material, or provider metadata.

## 2026-06-27: Keep Real SDK Adapter Optional

The OpenAI Agents SDK adapter is represented as an optional boundary in 0.1. The deterministic project proof uses stubs, while real SDK execution requires explicit credentials, optional package installation, prompts, and spend controls. This keeps CI free and prevents accidental API calls.

## 2026-06-27: Require Explicit Live Flag For OpenAI Calls

OpenAI-powered agents and judges require `--live` before any API call. `--dry-run` exercises the same adapter path without network access. This keeps the default CLI safe for CI, demos, and contributors without credentials.

Judge calls can use `--judge-max-output-tokens` separately from debate turns because structured JSON votes need more room than short speeches. This was added after a live smoke showed the judge JSON could truncate under a low global cap.

## 2026-06-27: Use Git-Rendered Archive README

`debateclub ledger rebuild` now writes both `matches/index.json` and `matches/README.md`. The README makes the open debate ledger browsable directly on GitHub without introducing a hosted database.

The rendered archive timestamp is derived from the newest committed match timestamp, not wall-clock rebuild time. This keeps Git-backed ledger rebuilds deterministic when the match artifacts have not changed.

## 2026-06-27: Keep Static Match Artifacts Canonical

Debate Club uses committed match files as the canonical database. `public-db/` is a deterministic static projection for browsers and downstream tools. A hosted SQL database may later be introduced as a cache or index, but not as the source of truth.

## 2026-06-27: Publish Every Valid Completed Match

All schema-valid completed matches enter the ledger and public DB by default. Quality is data, not an admission gate. Invalid or failed runs belong under a separate failed-runs path and do not enter the valid ledger. This supersedes the earlier manual-curation assumption for real-model matches.

## 2026-06-27: Treat Provider Traces As Debug Metadata

Provider traces are optional and non-canonical. Tracing stays disabled by default, sensitive trace payloads and Responses storage remain disabled, and captured trace IDs are recorded locally when tracing is explicitly enabled.
