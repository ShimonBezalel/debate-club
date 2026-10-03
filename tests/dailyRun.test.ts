import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runDailyMatch, type DailyRunOptions } from "../src/daily/runDaily.js";
import { loadEvergreenCatalog } from "../src/daily/catalog.js";
import { planDailyMatch } from "../src/daily/plan.js";

const failure = vi.hoisted(() => ({ afterWrite: false }));
vi.mock("../src/ledger/artifacts.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/ledger/artifacts.js")>();
  return {
    ...original,
    writeMatchArtifacts: async (...args: Parameters<typeof original.writeMatchArtifacts>) => {
      const result = await original.writeMatchArtifacts(...args);
      if (failure.afterWrite) throw new Error("simulated interruption during artifact publication");
      return result;
    }
  };
});

async function dailyOptions(date: string): Promise<DailyRunOptions> {
  const root = await mkdtemp(join(tmpdir(), "debate-club-daily-"));
  return {
    date,
    catalogPath: "topics/evergreen-v1.yaml",
    protocolPath: "examples/protocols/classic_v1.yaml",
    agentsRoot: "examples/agents",
    judgesPath: "examples/judges/panels/openai_epistemic_panel_v1",
    matchesRoot: join(root, "matches"),
    judgeLimit: 1,
    adapterOptions: {
      dryRun: true,
      model: "gpt-5.6-luna",
      judgeModel: "gpt-5.6-luna",
      reasoningEffort: "none",
      maxOutputTokens: 260,
      judgeMaxOutputTokens: 700,
      tracing: false
    }
  };
}

describe("daily match execution", () => {
  it("writes the planned match and rebuilds the ledger", async () => {
    const options = await dailyOptions("2026-09-04");

    const result = await runDailyMatch(options);

    expect(result).toMatchObject({ status: "created", ledgerMatches: 1, winner: "tie" });
    const match = JSON.parse(await readFile(join(result.folder, "match.json"), "utf8"));
    expect(match).toMatchObject({
      match_id: result.plan.matchId,
      agents: {
        pro: { name: "cross-examiner-v1", model_config: { model: "gpt-5.6-luna", reasoning_effort: "none" } },
        con: { name: "steelman-v1", model_config: { model: "gpt-5.6-luna", reasoning_effort: "none" } }
      }
    });
    expect(match.judge_votes).toHaveLength(1);
    const index = JSON.parse(await readFile(join(options.matchesRoot, "index.json"), "utf8"));
    expect(index.matches.map((entry: { match_id: string }) => entry.match_id)).toEqual([result.plan.matchId]);
  });

  it("leaves an existing date untouched", async () => {
    const options = await dailyOptions("2026-09-04");
    const first = await runDailyMatch(options);
    const original = await readFile(join(first.folder, "match.json"), "utf8");

    const second = await runDailyMatch(options);

    expect(second.status).toBe("exists");
    expect(second.ledgerMatches).toBe(1);
    expect(await readFile(join(first.folder, "match.json"), "utf8")).toBe(original);
  });

  it("refuses an incomplete directory instead of treating it as published", async () => {
    const options = await dailyOptions("2026-10-02");
    const plan = planDailyMatch(options.date, await loadEvergreenCatalog(options.catalogPath));
    await mkdir(join(options.matchesRoot, plan.matchId), { recursive: true });

    await expect(runDailyMatch(options)).rejects.toThrow(/incomplete/i);
  });

  it("keeps failed artifact writes outside the canonical date directory", async () => {
    const options = await dailyOptions("2026-10-02");
    const plan = planDailyMatch(options.date, await loadEvergreenCatalog(options.catalogPath));
    failure.afterWrite = true;
    try {
      await expect(runDailyMatch(options)).rejects.toThrow(/simulated interruption/);
      expect(existsSync(join(options.matchesRoot, plan.matchId))).toBe(false);
    } finally {
      failure.afterWrite = false;
    }
    expect((await runDailyMatch(options)).status).toBe("created");
  });

  it("preserves idempotency for callers selecting more than one judge", async () => {
    const options = { ...await dailyOptions("2026-10-02"), judgeLimit: 2 };
    const first = await runDailyMatch(options);
    const original = await readFile(join(first.folder, "match.json"), "utf8");
    expect(JSON.parse(original).judge_votes).toHaveLength(2);

    expect((await runDailyMatch(options)).status).toBe("exists");
    expect(await readFile(join(first.folder, "match.json"), "utf8")).toBe(original);
  });
});
