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
  return index;
}
