import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { agentCardSchema, judgeCardSchema, judgePanelSchema } from "../src/schemas/cards.js";
import { conjectureSchema } from "../src/schemas/conjecture.js";
import { judgeVoteSchema } from "../src/schemas/judgeVote.js";
import { loadYamlFile } from "../src/schemas/load.js";
import { protocolSchema } from "../src/schemas/protocol.js";

describe("schemas", () => {
  it("parses a structured conjecture", () => {
    const parsed = conjectureSchema.parse({
      id: "ai_tutors_homework_001",
      statement: "AI tutors should replace traditional homework for middle-school students.",
      domain: "education_policy",
      truth_type: "policy",
      stance_mode: "forced_random",
      evidence_mode: "no_external_info",
      allowed_tools: { web: false, calculator: false, evidence_pack: false },
      rubric_notes: ["distinguish replacement from supplementation"]
    });
    expect(parsed.truth_type).toBe("policy");
  });

  it("rejects an unsupported truth type", () => {
    expect(() =>
      conjectureSchema.parse({
        id: "bad",
        statement: "Bad",
        domain: "test",
        truth_type: "vibes",
        stance_mode: "forced_random",
        evidence_mode: "no_external_info",
        allowed_tools: { web: false, calculator: false, evidence_pack: false },
        rubric_notes: []
      })
    ).toThrow();
  });

  it("parses classic_v1 protocol turns", () => {
    const parsed = protocolSchema.parse({
      id: "classic_v1",
      prep_time_sec: 180,
      max_turn_tokens: 700,
      turns: [
        { id: "pro_opening", speaker: "pro", phase: "opening", time_sec: 120 },
        { id: "con_opening", speaker: "con", phase: "opening", time_sec: 120 }
      ]
    });
    expect(parsed.turns.map((turn) => turn.speaker)).toEqual(["pro", "con"]);
  });

  it("parses agent and judge cards plus panel", () => {
    expect(agentCardSchema.parse({
      name: "stub-pro-v1",
      version: "0.1.0",
      description: "Deterministic pro agent",
      adapter: "stub",
      private: false,
      supports: ["no_external_info"],
      input_modes: ["text"],
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    }).adapter).toBe("stub");

    expect(judgeCardSchema.parse({
      id: "epistemic-stub-v1",
      name: "Epistemic Stub",
      version: "0.1.0",
      adapter: "stub",
      public: true,
      rubric: {
        factual_accuracy: 0.25,
        responsiveness: 0.2,
        argument_structure: 0.2,
        burden_of_proof: 0.15,
        handling_counterarguments: 0.15,
        style_clarity: 0.05
      }
    }).public).toBe(true);

    expect(judgePanelSchema.parse({
      id: "stub_panel",
      judges: ["epistemic_stub_v1.yaml"]
    }).judges).toHaveLength(1);
  });

  it("parses structured judge votes", () => {
    const vote = judgeVoteSchema.parse({
      judge_id: "epistemic-stub-v1",
      winner: "pro",
      confidence: 0.72,
      scores: {
        pro: { factual_accuracy: 8, responsiveness: 7, argument_structure: 8, burden_of_proof: 7, handling_counterarguments: 9, style_clarity: 8 },
        con: { factual_accuracy: 7, responsiveness: 8, argument_structure: 7, burden_of_proof: 6, handling_counterarguments: 6, style_clarity: 8 }
      },
      decisive_moments: [{ turn_id: "pro_rebuttal", reason: "Pro answered the strongest objection." }],
      flags: [{ side: "con", type: "unsupported_empirical_claim", severity: "medium", quote: "It always works." }]
    });
    expect(vote.confidence).toBeGreaterThan(0.7);
  });

  it("loads YAML files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "debate-club-schema-"));
    const file = join(dir, "sample.yaml");
    await writeFile(file, "id: classic_v1\nprep_time_sec: 180\nmax_turn_tokens: 700\nturns: []\n");
    const loaded = await loadYamlFile(file);
    expect(loaded).toMatchObject({ id: "classic_v1" });
  });
});
