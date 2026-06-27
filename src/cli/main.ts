#!/usr/bin/env node
import { existsSync } from "node:fs";
import { symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_OPENAI_JUDGE_MODEL, DEFAULT_OPENAI_MODEL, DEFAULT_TEMPERATURE, DEFAULT_TIMEOUT_MS, openAiAgentsSdkAvailable, openAiApiKeyPresent, type LiveAdapterOptions } from "../adapters/openaiAgentsSdk.js";
import { loadAgentFromDirectory } from "../agents/loadAgent.js";
import { writeMatchArtifacts } from "../ledger/artifacts.js";
import { buildLeaderboard } from "../ledger/leaderboard.js";
import { rebuildLedgerIndex } from "../ledger/rebuild.js";
import { replayMatch } from "../ledger/replay.js";
import { loadJudgePanel } from "../judges/loadPanel.js";
import { runMatch } from "../runner/runMatch.js";
import { conjectureSchema } from "../schemas/conjecture.js";
import { explainZodError, loadYamlFile } from "../schemas/load.js";
import { protocolSchema } from "../schemas/protocol.js";

function defaultMatchId(conjectureId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${conjectureId}`;
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received '${value}'.`);
  }
  return parsed;
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a number, received '${value}'.`);
  }
  return parsed;
}

function liveOptions(options: {
  live?: boolean;
  dryRun?: boolean;
  model?: string;
  judgeModel?: string;
  maxOutputTokens?: number;
  judgeMaxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  tracing?: boolean;
}): LiveAdapterOptions {
  return {
    live: Boolean(options.live),
    dryRun: Boolean(options.dryRun),
    model: options.model,
    judgeModel: options.judgeModel,
    maxOutputTokens: options.maxOutputTokens,
    judgeMaxOutputTokens: options.judgeMaxOutputTokens,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs,
    tracing: Boolean(options.tracing)
  };
}

async function updateLatestLink(matchesRoot: string, matchId: string): Promise<void> {
  const latest = join(matchesRoot, "latest");
  if (existsSync(latest)) {
    await unlink(latest);
  }
  await symlink(matchId, latest);
}

async function main(): Promise<void> {
  const program = new Command();
  program.name("debateclub").description("Run Debate Club matches and manage the open debate ledger.").version("0.1.0");

  program.command("run")
    .requiredOption("--protocol <path>")
    .requiredOption("--conjecture <path>")
    .requiredOption("--pro <directory>")
    .requiredOption("--con <directory>")
    .requiredOption("--judges <directory>")
    .requiredOption("--out <directory>")
    .option("--match-id <id>")
    .option("--live", "allow live OpenAI adapter calls")
    .option("--dry-run", "validate live adapter paths without API calls")
    .option("--model <model>", "OpenAI model for debaters")
    .option("--judge-model <model>", "OpenAI model for judges")
    .option("--max-output-tokens <tokens>", "maximum output tokens for live model calls", parsePositiveInt)
    .option("--judge-max-output-tokens <tokens>", "maximum output tokens for live judge calls", parsePositiveInt)
    .option("--temperature <temperature>", "model temperature for live calls", parseNumber)
    .option("--timeout-ms <milliseconds>", "timeout per live model call", parsePositiveInt)
    .option("--judge-limit <count>", "limit number of judges loaded from panel", parsePositiveInt)
    .option("--tracing", "enable OpenAI Agents SDK tracing")
    .action(async (options) => {
      try {
        const protocol = protocolSchema.parse(await loadYamlFile(options.protocol));
        const conjecture = conjectureSchema.parse(await loadYamlFile(options.conjecture));
        const matchId = options.matchId ?? defaultMatchId(conjecture.id);
        const adapterOptions = liveOptions(options);
        const match = await runMatch({
          protocol,
          conjecture,
          agents: { pro: await loadAgentFromDirectory(options.pro, adapterOptions), con: await loadAgentFromDirectory(options.con, adapterOptions) },
          judges: await loadJudgePanel(options.judges, { ...adapterOptions, judgeLimit: options.judgeLimit }),
          matchId
        });
        const folder = await writeMatchArtifacts(match, options.out);
        const index = await rebuildLedgerIndex(options.out);
        await updateLatestLink(options.out, match.match_id).catch(() => undefined);
        process.stdout.write(`Wrote match ${match.match_id}\nFolder: ${folder}\nLedger matches: ${index.matches.length}\nWinner: ${match.result.winner}\n`);
      } catch (error) {
        process.stderr.write(`debateclub run failed: ${explainZodError(error)}\n`);
        process.exitCode = 1;
      }
    });

  program.command("doctor")
    .description("Check optional live adapter configuration without printing secrets.")
    .action(async () => {
      const sdkAvailable = await openAiAgentsSdkAvailable();
      const keyPresent = openAiApiKeyPresent();
      process.stdout.write([
        "Debate Club doctor",
        `OpenAI Agents SDK installed: ${sdkAvailable ? "yes" : "no"}`,
        `OPENAI_API_KEY present: ${keyPresent ? "yes" : "no"}`,
        `Default debater model: ${process.env.DEBATECLUB_MODEL ?? DEFAULT_OPENAI_MODEL}`,
        `Default judge model: ${process.env.DEBATECLUB_JUDGE_MODEL ?? DEFAULT_OPENAI_JUDGE_MODEL}`,
        `Default max output tokens: ${DEFAULT_MAX_OUTPUT_TOKENS}`,
        `Default temperature: ${DEFAULT_TEMPERATURE}`,
        `Default timeout ms: ${DEFAULT_TIMEOUT_MS}`,
        ""
      ].join("\n"));
    });

  program.command("replay")
    .argument("<match-directory>")
    .action(async (matchDirectory) => {
      try {
        process.stdout.write(await replayMatch(matchDirectory));
      } catch (error) {
        process.stderr.write(`debateclub replay failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    });

  const ledger = program.command("ledger");
  ledger.command("rebuild")
    .requiredOption("--matches <directory>")
    .action(async (options) => {
      try {
        const index = await rebuildLedgerIndex(options.matches);
        process.stdout.write(`Rebuilt ledger with ${index.matches.length} match${index.matches.length === 1 ? "" : "es"}\n`);
      } catch (error) {
        process.stderr.write(`debateclub ledger rebuild failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    });

  program.command("leaderboard")
    .argument("<matches-directory>")
    .action(async (matchesDirectory) => {
      try {
        process.stdout.write(await buildLeaderboard(matchesDirectory));
      } catch (error) {
        process.stderr.write(`debateclub leaderboard failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
