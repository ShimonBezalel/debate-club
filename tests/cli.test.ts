import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function runCli(args: string[]) {
  return execFileAsync("npx", ["tsx", "src/cli/main.ts", ...args], { cwd: process.cwd() });
}

describe("cli", () => {
  it("creates an idempotent dry-run daily match", async () => {
    const root = await mkdtemp(join(tmpdir(), "debate-club-cli-daily-"));
    const out = join(root, "matches");
    const args = ["daily", "--date", "2026-09-04", "--dry-run", "--out", out];

    const first = await runCli(args);
    expect(first.stdout).toContain("Daily match created");

    const second = await runCli(args);
    expect(second.stdout).toContain("already exists");
    const index = JSON.parse(await readFile(join(out, "index.json"), "utf8")) as { matches: unknown[] };
    expect(index.matches).toHaveLength(1);
    const matchId = (index.matches[0] as { match_id: string }).match_id;
    const match = JSON.parse(await readFile(join(out, matchId, "match.json"), "utf8"));
    expect(match.agents.pro.model_config.model).toBe("gpt-6-luna");
    expect(match.agents.con.model_config.model).toBe("gpt-6-luna");
    expect(match.judge_votes[0].metadata.model).toBe("gpt-6-luna");
  });

  // Four CLI process launches need CI startup headroom.
  it("runs, rebuilds, replays, and summarizes a stub debate", { timeout: 15_000 }, async () => {
    const out = await mkdtemp(join(tmpdir(), "debate-club-cli-"));
    const run = await runCli([
      "run",
      "--protocol", "examples/protocols/classic_v1.yaml",
      "--conjecture", "examples/conjectures/ai_tutors_homework_001.yaml",
      "--pro", "examples/agents/stub_pro",
      "--con", "examples/agents/stub_con",
      "--judges", "examples/judges/stub_panel",
      "--out", out,
      "--match-id", "cli-match-001"
    ]);
    expect(run.stdout).toContain("cli-match-001");

    const index = JSON.parse(await readFile(join(out, "index.json"), "utf8")) as { matches: unknown[] };
    expect(index.matches).toHaveLength(1);

    const replay = await runCli(["replay", join(out, "cli-match-001")]);
    expect(replay.stdout).toContain("Debate Transcript");

    const rebuild = await runCli(["ledger", "rebuild", "--matches", out]);
    expect(rebuild.stdout).toContain("1 match");

    const leaderboard = await runCli(["leaderboard", out]);
    expect(leaderboard.stdout).toContain("Agent | Wins | Matches");
  });
});
