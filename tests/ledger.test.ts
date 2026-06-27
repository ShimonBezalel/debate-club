import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAgentFromDirectory } from "../src/agents/loadAgent.js";
import { writeMatchArtifacts } from "../src/ledger/artifacts.js";
import { buildLeaderboard } from "../src/ledger/leaderboard.js";
import { rebuildLedgerIndex } from "../src/ledger/rebuild.js";
import { replayMatch } from "../src/ledger/replay.js";
import { loadJudgePanel } from "../src/judges/loadPanel.js";
import { runMatch } from "../src/runner/runMatch.js";
import { conjectureSchema } from "../src/schemas/conjecture.js";
import { loadYamlFile } from "../src/schemas/load.js";
import { protocolSchema } from "../src/schemas/protocol.js";

async function createMatch() {
  const protocol = protocolSchema.parse(await loadYamlFile("examples/protocols/classic_v1.yaml"));
  const conjecture = conjectureSchema.parse(await loadYamlFile("examples/conjectures/ai_tutors_homework_001.yaml"));
  return runMatch({
    protocol,
    conjecture,
    agents: { pro: await loadAgentFromDirectory("examples/agents/stub_pro"), con: await loadAgentFromDirectory("examples/agents/stub_con") },
    judges: await loadJudgePanel("examples/judges/stub_panel"),
    matchId: "match-ledger-001"
  });
}

describe("ledger artifacts", () => {
  it("writes match artifacts and rebuilds the index", async () => {
    const out = await mkdtemp(join(tmpdir(), "debate-club-ledger-"));
    const match = await createMatch();
    const folder = await writeMatchArtifacts(match, out);
    const transcript = await readFile(join(folder, "transcript.md"), "utf8");
    const scorecard = await readFile(join(folder, "scorecard.md"), "utf8");
    expect(transcript).toContain("# Debate Transcript");
    expect(scorecard).toContain("Winner");

    const index = await rebuildLedgerIndex(out);
    expect(index.matches).toHaveLength(1);
    expect(index.matches[0]?.match_id).toBe("match-ledger-001");
    const readme = await readFile(join(out, "README.md"), "utf8");
    expect(readme).toContain("| Match | Featured | Conjecture |");

    const replay = await replayMatch(folder);
    expect(replay).toContain("pro_opening");

    const leaderboard = await buildLeaderboard(out);
    expect(leaderboard).toContain("stub-pro-v1");
  });
});
