import type { DebateAgent } from "../agents/interface.js";
import type { AgentCard, DebateEvent, DebateMove, DebateObservation, MatchContext, TurnBudget } from "../types/core.js";

const openAiAgentsPackage = "@openai/agents";

export async function openAiAgentsSdkAvailable(): Promise<boolean> {
  try {
    await import(openAiAgentsPackage);
    return true;
  } catch {
    return false;
  }
}

export async function createOpenAiAgentsSdkAgent(card: AgentCard): Promise<DebateAgent> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the openai-agents-sdk adapter.");
  }
  const available = await openAiAgentsSdkAvailable();
  if (!available) {
    throw new Error("Install optional package @openai/agents to use the openai-agents-sdk adapter.");
  }

  return {
    card,
    async prepare(_context: MatchContext): Promise<void> {
      return undefined;
    },
    async speak(observation: DebateObservation, _budget: TurnBudget): Promise<DebateMove> {
      throw new Error(`The openai-agents-sdk adapter boundary loaded for ${observation.match_id}, but live SDK speech is disabled until model prompts and spend controls are explicitly configured.`);
    },
    async observe(_event: DebateEvent): Promise<void> {
      return undefined;
    }
  };
}
