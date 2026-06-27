import { describe, expect, it } from "vitest";
import { createOpenAiAgentsSdkAgent, openAiAgentsSdkAvailable } from "../src/adapters/openaiAgentsSdk.js";

describe("openai agents sdk adapter boundary", () => {
  it("reports availability without requiring credentials", async () => {
    const available = await openAiAgentsSdkAvailable();
    expect(typeof available).toBe("boolean");
  });

  it("fails clearly when asked to create an agent without OPENAI_API_KEY", async () => {
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
    })).rejects.toThrow(/OPENAI_API_KEY/);
    if (previous) {
      process.env.OPENAI_API_KEY = previous;
    }
  });
});
