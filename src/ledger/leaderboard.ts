import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LedgerIndex } from "./rebuild.js";

export async function buildLeaderboard(matchesRoot: string): Promise<string> {
  const index = JSON.parse(await readFile(join(matchesRoot, "index.json"), "utf8")) as LedgerIndex;
  const rows = new Map<string, { wins: number; matches: number }>();
  for (const match of index.matches) {
    for (const agent of [match.pro_agent, match.con_agent]) {
      rows.set(agent, rows.get(agent) ?? { wins: 0, matches: 0 });
      rows.get(agent)!.matches += 1;
    }
    if (match.winner === "pro") {
      rows.get(match.pro_agent)!.wins += 1;
    }
    if (match.winner === "con") {
      rows.get(match.con_agent)!.wins += 1;
    }
  }
  const lines = ["Agent | Wins | Matches", "--- | ---: | ---:"];
  for (const [agent, score] of [...rows.entries()].sort((a, b) => b[1].wins - a[1].wins || a[0].localeCompare(b[0]))) {
    lines.push(`${agent} | ${score.wins} | ${score.matches}`);
  }
  return `${lines.join("\n")}\n`;
}
