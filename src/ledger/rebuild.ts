import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompletedMatch } from "../types/core.js";

export interface LedgerIndex {
  generated_at: string;
  matches: Array<{
    match_id: string;
    created_at: string;
    conjecture_id: string;
    conjecture_statement: string;
    protocol_id: string;
    pro_agent: string;
    con_agent: string;
    winner: string;
    judge_split: Record<string, number>;
    confidence_mean: number;
    featured: boolean;
    judges: string[];
    paths: {
      match: string;
      transcript: string;
      scorecard: string;
    };
  }>;
}

export async function rebuildLedgerIndex(matchesRoot: string): Promise<LedgerIndex> {
  const entries = await readdir(matchesRoot, { withFileTypes: true }).catch(() => []);
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const matchPath = join(matchesRoot, entry.name, "match.json");
    const raw = await readFile(matchPath, "utf8").catch(() => undefined);
    if (!raw) {
      continue;
    }
    const match = JSON.parse(raw) as CompletedMatch;
    matches.push({
      match_id: match.match_id,
      created_at: match.created_at,
      conjecture_id: match.conjecture.id,
      conjecture_statement: match.conjecture.statement,
      protocol_id: match.protocol.id,
      pro_agent: match.agents.pro.name,
      con_agent: match.agents.con.name,
      winner: match.result.winner,
      judge_split: match.result.judge_split,
      confidence_mean: match.result.confidence_mean,
      featured: Boolean(match.conjecture.featured),
      judges: match.judge_votes.map((vote) => vote.judge_id),
      paths: {
        match: `${entry.name}/match.json`,
        transcript: `${entry.name}/transcript.md`,
        scorecard: `${entry.name}/scorecard.md`
      }
    });
  }
  matches.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const index = { generated_at: new Date().toISOString(), matches };
  await writeFile(join(matchesRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(join(matchesRoot, "README.md"), renderLedgerReadme(index));
  return index;
}

export function renderLedgerReadme(index: LedgerIndex): string {
  const lines = [
    "# Debate Club Match Archive",
    "",
    "This directory is the Git-backed open debate ledger. Every match is a reproducible artifact with transcript, JSONL turns, judge votes, scorecard, timing, tool log, and match metadata.",
    "",
    `Generated: ${index.generated_at}`,
    "",
    "| Match | Featured | Conjecture | Protocol | Pro | Con | Winner | Judge split | Transcript | Scorecard |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const match of index.matches) {
    const split = `pro ${match.judge_split.pro ?? 0}, con ${match.judge_split.con ?? 0}, tie ${match.judge_split.tie ?? 0}`;
    lines.push([
      `| ${match.match_id}`,
      match.featured ? "yes" : "no",
      match.conjecture_statement.replaceAll("|", "\\|"),
      match.protocol_id,
      match.pro_agent,
      match.con_agent,
      match.winner,
      split,
      `[transcript](${match.paths.transcript})`,
      `[scorecard](${match.paths.scorecard}) |`
    ].join(" | "));
  }
  return `${lines.join("\n")}\n`;
}
