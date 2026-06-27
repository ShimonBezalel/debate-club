import type { AgentCard, DebateEvent, DebateMove, DebateObservation, MatchContext, TurnBudget } from "../types/core.js";

export interface DebateAgent {
  card: AgentCard;
  prepare(context: MatchContext): Promise<void>;
  speak(observation: DebateObservation, budget: TurnBudget): Promise<DebateMove>;
  observe(event: DebateEvent): Promise<void>;
}
