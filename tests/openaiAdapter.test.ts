import { describe, expect, it } from "vitest";
import { createOpenAiAgentsSdkAgent, createOpenAiAgentsSdkJudge, openAiAgentsSdkAvailable } from "../src/adapters/openaiAgentsSdk.js";

describe("openai agents sdk adapter boundary", () => {
  it("reports availability without requiring credentials", async () => {
    const available = await openAiAgentsSdkAvailable();
    expect(typeof available).toBe("boolean");
  });

  it("requires explicit live or dry-run mode", async () => {
    await expect(createOpenAiAgentsSdkAgent({
      name: "openai-example-v1",
      version: "0.1.0",
      description: "example",
      adapter: "openai-agents-sdk",
      private: true,
      supports: ["no_external_info"],
      input_modes: ["text"],
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    })).rejects.toThrow(/--live|--dry-run/);
  });

  it("dry-runs an OpenAI agent without credentials", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const agent = await createOpenAiAgentsSdkAgent({
      name: "openai-example-v1",
      version: "0.1.0",
      description: "example",
      adapter: "openai-agents-sdk",
      private: true,
      supports: ["no_external_info"],
      input_modes: ["text"],
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    }, undefined, { dryRun: true });
    const move = await agent.speak({
      match_id: "dry-run-match",
      conjecture: {
        id: "c1",
        statement: "Git-backed ledgers are useful.",
        domain: "technical_design",
        truth_type: "technical_design",
        stance_mode: "assigned",
        evidence_mode: "no_external_info",
        allowed_tools: { web: false, calculator: false, evidence_pack: false },
        rubric_notes: []
      },
      protocol: { id: "classic_v1", prep_time_sec: 30, max_turn_tokens: 120, turns: [] },
      side: "pro",
      turn: { id: "pro_opening", speaker: "pro", phase: "opening", time_sec: 30 },
      transcript: []
    }, { time_sec: 30, max_tokens: 120 });
    expect(move.metadata?.dry_run).toBe(true);
    if (previous) {
      process.env.OPENAI_API_KEY = previous;
    }
  });

  it("dry-runs an OpenAI judge without credentials", async () => {
    const judge = await createOpenAiAgentsSdkJudge({
      id: "epistemic-judge-v1",
      name: "Epistemic Judge",
      version: "0.1.0",
      adapter: "openai-agents-sdk",
      public: true,
      rubric: {
        factual_accuracy: 0.25,
        responsiveness: 0.2,
        argument_structure: 0.2,
        burden_of_proof: 0.15,
        handling_counterarguments: 0.15,
        style_clarity: 0.05
      }
    }, undefined, { dryRun: true });
    const vote = await judge.judge({
      match_id: "dry-judge-match",
      created_at: "2026-06-27T00:00:00.000Z",
      conjecture: {
        id: "c1",
        statement: "Git-backed ledgers are useful.",
        domain: "technical_design",
        truth_type: "technical_design",
        stance_mode: "assigned",
        evidence_mode: "no_external_info",
        allowed_tools: { web: false, calculator: false, evidence_pack: false },
        rubric_notes: []
      },
      protocol: { id: "classic_v1", prep_time_sec: 30, max_turn_tokens: 120, turns: [] },
      agents: {
        pro: { name: "a", version: "0.1.0", description: "a", adapter: "stub", private: false, supports: ["no_external_info"], input_modes: ["text"], resource_limits: { max_wall_time_sec: 30, max_tokens_per_turn: 120 } },
        con: { name: "b", version: "0.1.0", description: "b", adapter: "stub", private: false, supports: ["no_external_info"], input_modes: ["text"], resource_limits: { max_wall_time_sec: 30, max_tokens_per_turn: 120 } }
      },
      transcript: [],
      judge_votes: [],
      result: { winner: "tie", judge_split: { pro: 0, con: 0, tie: 0 }, confidence_mean: 0, confidence_variance: 0, flags: [] }
    });
    expect(vote.metadata?.dry_run).toBe(true);
  });

  it("fails clearly when live mode lacks OPENAI_API_KEY", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(createOpenAiAgentsSdkAgent({
      name: "openai-example-v1",
      version: "0.1.0",
      description: "example",
      adapter: "openai-agents-sdk",
      private: true,
      supports: ["no_external_info"],
      input_modes: ["text"],
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    }, undefined, { live: true })).rejects.toThrow(/OPENAI_API_KEY/);
    if (previous) {
      process.env.OPENAI_API_KEY = previous;
    }
  });
});
