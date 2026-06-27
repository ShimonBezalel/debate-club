import { describe, expect, it } from "vitest";
import { loadAgentFromDirectory } from "../src/agents/loadAgent.js";
import { createStubAgent } from "../src/agents/stubAgent.js";
import { loadJudgePanel } from "../src/judges/loadPanel.js";

describe("stub agents and judges", () => {
  it("creates deterministic stub agent moves", async () => {
    const agent = createStubAgent({
      name: "stub-pro-v1",
      version: "0.1.0",
      description: "test",
      adapter: "stub",
      private: false,
      supports: ["no_external_info"],
      input_modes: ["text"],
      stance: "pro",
      style: "structured_policy_case",
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    });
    const move = await agent.speak({
      match_id: "match-test",
      conjecture: {
        id: "c1",
        statement: "AI tutors should replace homework.",
        domain: "education_policy",
        truth_type: "policy",
        stance_mode: "forced_random",
        evidence_mode: "no_external_info",
        allowed_tools: { web: false, calculator: false, evidence_pack: false },
        rubric_notes: []
      },
      protocol: { id: "classic_v1", prep_time_sec: 180, max_turn_tokens: 700, turns: [] },
      side: "pro",
      turn: { id: "pro_opening", speaker: "pro", phase: "opening", time_sec: 120 },
      transcript: []
    }, { time_sec: 120, max_tokens: 700 });
    expect(move.text).toContain("Pro opening");
    expect(move.speaker).toBe("pro");
  });

  it("loads stub agent cards from directories", async () => {
    const agent = await loadAgentFromDirectory("examples/agents/stub_pro");
    expect(agent.card.name).toBe("stub-pro-v1");
  });

  it("loads stub judge panels", async () => {
    const judges = await loadJudgePanel("examples/judges/stub_panel");
    expect(judges).toHaveLength(1);
    expect(judges[0]?.card.id).toBe("epistemic-stub-v1");
  });
});
