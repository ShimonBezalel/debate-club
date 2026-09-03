import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LiveAdapterOptions } from "../adapters/openaiAgentsSdk.js";
import { loadAgentFromDirectory } from "../agents/loadAgent.js";
import { writeMatchArtifacts } from "../ledger/artifacts.js";
import { rebuildLedgerIndex } from "../ledger/rebuild.js";
import { loadJudgePanel } from "../judges/loadPanel.js";
import { runMatch } from "../runner/runMatch.js";
import { loadYamlFile } from "../schemas/load.js";
import { protocolSchema } from "../schemas/protocol.js";
import type { DebateWinner } from "../types/core.js";
import { loadEvergreenCatalog } from "./catalog.js";
import { planDailyMatch, type DailyMatchPlan } from "./plan.js";

export const DAILY_DEFAULT_MODEL = "gpt-5.6-luna";
export const DAILY_DEFAULT_MAX_OUTPUT_TOKENS = 260;
export const DAILY_DEFAULT_JUDGE_MAX_OUTPUT_TOKENS = 700;
export const DAILY_DEFAULT_JUDGE_LIMIT = 1;

export interface DailyRunOptions {
  date: string;
  catalogPath: string;
  protocolPath: string;
  agentsRoot: string;
  judgesPath: string;
  matchesRoot: string;
  judgeLimit: number;
  adapterOptions: LiveAdapterOptions;
}

export interface DailyRunResult {
  status: "created" | "exists";
  plan: DailyMatchPlan;
  folder: string;
  ledgerMatches: number;
  winner?: DebateWinner;
}

export async function runDailyMatch(options: DailyRunOptions): Promise<DailyRunResult> {
  const catalog = await loadEvergreenCatalog(options.catalogPath);
  const plan = planDailyMatch(options.date, catalog);
  const folder = join(options.matchesRoot, plan.matchId);
  await mkdir(options.matchesRoot, { recursive: true });
  if (existsSync(folder)) {
    const index = await rebuildLedgerIndex(options.matchesRoot);
    return { status: "exists", plan, folder, ledgerMatches: index.matches.length };
  }

  const protocol = protocolSchema.parse(await loadYamlFile(options.protocolPath));
  const agents = {
    pro: await loadAgentFromDirectory(join(options.agentsRoot, plan.proAgent), options.adapterOptions),
    con: await loadAgentFromDirectory(join(options.agentsRoot, plan.conAgent), options.adapterOptions)
  };
  const judges = await loadJudgePanel(options.judgesPath, {
    ...options.adapterOptions,
    judgeLimit: options.judgeLimit
  });
  const match = await runMatch({
    protocol,
    conjecture: plan.conjecture,
    agents,
    judges,
    matchId: plan.matchId
  });
  await writeMatchArtifacts(match, options.matchesRoot);
  const index = await rebuildLedgerIndex(options.matchesRoot);
  return {
    status: "created",
    plan,
    folder,
    ledgerMatches: index.matches.length,
    winner: match.result.winner
  };
}
