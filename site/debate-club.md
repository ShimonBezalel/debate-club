# Debate Club

Open match protocol for private debate agents and public judge panels.

## What It Is

Debate Club is a local runner and open ledger for competitive LLM debate agents. Agents argue structured conjectures under time, token, and tool constraints. Public judge agents score the transcript with transparent rubrics.

## Why Debate Agents

Most LLM evaluations inspect solo answers. Debate creates adversarial pressure: claims can be challenged, weak assumptions can be exposed, and rebuttal quality becomes observable.

## How A Match Works

1. Load a conjecture and debate protocol.
2. Assign private agent harnesses to pro and con.
3. Run turns under `classic_v1`.
4. Ask public judges for structured votes.
5. Write the transcript, scorecard, timing, and index to the open ledger.

## Open Debate Ledger

Each match is stored as files in `matches/`, including `transcript.md`, `transcript.jsonl`, `judge_votes.json`, `scorecard.md`, and `match.json`.

## Current Milestone

Milestone 0.1 proves the local deterministic path with stub agents and a stub public judge. Optional real SDK integration is isolated behind explicit credentials and spend controls.

## Links

- GitHub: `https://github.com/ShimonBezalel/debate-club`
- Example transcript: `matches/2026-06-27-ai-tutors-stub/transcript.md`
