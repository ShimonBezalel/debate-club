import { join } from "node:path";
import { agentCardSchema } from "../schemas/cards.js";
import { loadYamlFile } from "../schemas/load.js";
import { createStubAgent } from "./stubAgent.js";
import type { DebateAgent } from "./interface.js";

export async function loadAgentFromDirectory(directory: string): Promise<DebateAgent> {
  const card = agentCardSchema.parse(await loadYamlFile(join(directory, "agent_card.yaml")));
  if (card.adapter === "stub") {
    return createStubAgent(card);
  }
  throw new Error(`Agent adapter '${card.adapter}' requires optional configuration and is not available through loadAgentFromDirectory.`);
}
