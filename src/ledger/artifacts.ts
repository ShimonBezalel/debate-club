import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompletedMatch, DebateTurn } from "../types/core.js";

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function renderTranscriptMarkdown(match: CompletedMatch): string {
  const lines = [
    "# Debate Transcript",
    "",
    `Match: ${match.match_id}`,
    `Conjecture: ${match.conjecture.statement}`,
    `Protocol: ${match.protocol.id}`,
    "",
    ...match.transcript.flatMap((turn) => [
      `## ${turn.turn_id}`,
      "",
      `Speaker: ${turn.speaker}`,
      `Phase: ${turn.phase}`,
      `Time used: ${turn.time_used_sec.toFixed(3)}s`,
      `Token estimate: ${turn.tokens_estimate}`,
      "",
      turn.text,
      ""
    ])
  ];
  return `${lines.join("\n").trim()}\n`;
}

export function renderTranscriptJsonl(turns: DebateTurn[]): string {
  return `${turns.map((turn) => JSON.stringify(turn)).join("\n")}\n`;
}

export function renderScorecard(match: CompletedMatch): string {
  return [
    "# Debate Scorecard",
    "",
    `Match: ${match.match_id}`,
    `Winner: ${match.result.winner}`,
    `Judge split: pro ${match.result.judge_split.pro}, con ${match.result.judge_split.con}, tie ${match.result.judge_split.tie}`,
    `Mean confidence: ${match.result.confidence_mean.toFixed(2)}`,
    "",
    "## Judge Votes",
    "",
    ...match.judge_votes.flatMap((vote) => [
      `### ${vote.judge_id}`,
      "",
      `Winner: ${vote.winner}`,
      `Confidence: ${vote.confidence.toFixed(2)}`,
      `Decisive moments: ${vote.decisive_moments.map((moment) => `${moment.turn_id}: ${moment.reason}`).join("; ") || "None"}`,
      `Flags: ${vote.flags.length}`,
      ""
    ])
  ].join("\n");
}

export async function writeMatchArtifacts(match: CompletedMatch, outputRoot: string): Promise<string> {
  const folder = join(outputRoot, match.match_id);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "match.json"), json(match));
  await writeFile(join(folder, "transcript.md"), renderTranscriptMarkdown(match));
  await writeFile(join(folder, "transcript.jsonl"), renderTranscriptJsonl(match.transcript));
  await writeFile(join(folder, "judge_votes.json"), json(match.judge_votes));
  await writeFile(join(folder, "scorecard.md"), renderScorecard(match));
  await writeFile(join(folder, "timing.json"), json({ turns: match.transcript.map((turn) => ({ turn_id: turn.turn_id, time_used_sec: turn.time_used_sec, tokens_estimate: turn.tokens_estimate })) }));
  await writeFile(join(folder, "tool_log.json"), json({ tools_used: [], evidence_mode: match.conjecture.evidence_mode }));
  return folder;
}
