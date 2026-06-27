# Decisions

## 2026-06-27: Use MIT License For Milestone 0.1

The project starts under MIT because the approved design calls for a permissive open-source repository and no alternative license preference has been supplied. This can be changed before the first public release if needed.

## 2026-06-27: Commit One Curated Stub Match

Milestone 0.1 commits one deterministic stub match so new users can inspect the ledger shape without spending API tokens. Real model match artifacts should be curated before commit because transcripts can contain private prompts, sensitive source material, or provider metadata.

## 2026-06-27: Keep Real SDK Adapter Optional

The OpenAI Agents SDK adapter is represented as an optional boundary in 0.1. The deterministic project proof uses stubs, while real SDK execution requires explicit credentials, optional package installation, prompts, and spend controls. This keeps CI free and prevents accidental API calls.

## 2026-06-27: Require Explicit Live Flag For OpenAI Calls

OpenAI-powered agents and judges require `--live` before any API call. `--dry-run` exercises the same adapter path without network access. This keeps the default CLI safe for CI, demos, and contributors without credentials.

## 2026-06-27: Use Git-Rendered Archive README

`debateclub ledger rebuild` now writes both `matches/index.json` and `matches/README.md`. The README makes the open debate ledger browsable directly on GitHub without introducing a hosted database.
