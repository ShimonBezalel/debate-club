#!/usr/bin/env node
import { existsSync } from "node:fs";
import { symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
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
    .action(async (options) => {
      try {
        const protocol = protocolSchema.parse(await loadYamlFile(options.protocol));
        const conjecture = conjectureSchema.parse(await loadYamlFile(options.conjecture));
        const matchId = options.matchId ?? defaultMatchId(conjecture.id);
        const match = await runMatch({
          protocol,
          conjecture,
          agents: { pro: await loadAgentFromDirectory(options.pro), con: await loadAgentFromDirectory(options.con) },
          judges: await loadJudgePanel(options.judges),
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
