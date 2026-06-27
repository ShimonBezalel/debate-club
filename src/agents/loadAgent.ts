import { join } from "node:path";
import { createOpenAiAgentsSdkAgent, type LiveAdapterOptions } from "../adapters/openaiAgentsSdk.js";
import { agentCardSchema } from "../schemas/cards.js";
import { loadYamlFile } from "../schemas/load.js";
import { createStubAgent } from "./stubAgent.js";
import type { DebateAgent } from "./interface.js";

export async function loadAgentFromDirectory(directory: string, options: LiveAdapterOptions = {}): Promise<DebateAgent> {
  const card = agentCardSchema.parse(await loadYamlFile(join(directory, "agent_card.yaml")));
  if (card.adapter === "stub") {
    return createStubAgent(card);
  }
  if (card.adapter === "openai-agents-sdk") {
    return createOpenAiAgentsSdkAgent(card, directory, options);
  }
  throw new Error(`Unsupported agent adapter '${card.adapter}'.`);
}
