import type { AgentCard, DebateEvent, DebateMove, DebateObservation, MatchContext, TurnBudget } from "../types/core.js";
import type { DebateAgent } from "./interface.js";

function phaseLabel(phase: string): string {
  return phase.replaceAll("_", " ");
}

function sideLabel(side: "pro" | "con"): string {
  return side === "pro" ? "Pro" : "Con";
}

export function createStubAgent(card: AgentCard): DebateAgent {
  const observedTurns: string[] = [];
  return {
    card,
    async prepare(_context: MatchContext): Promise<void> {
      observedTurns.length = 0;
    },
    async speak(observation: DebateObservation, _budget: TurnBudget): Promise<DebateMove> {
      const label = `${sideLabel(observation.side)} ${phaseLabel(observation.turn.phase)}`;
      const opponentClaims = observation.transcript.length === 0
        ? "No prior claims have been made."
        : `Prior claims: ${observation.transcript.map((turn) => turn.turn_id).join(", ")}.`;
      const stanceClaim = observation.side === "pro"
        ? "Replacement deserves a fair trial when it improves feedback speed, personalization, and accountability."
        : "Replacement is too strong because homework also builds practice habits, teacher context, and equitable routines.";
      return {
        turn_id: observation.turn.id,
        speaker: observation.side,
        phase: observation.turn.phase,
        text: `${label}: ${stanceClaim} ${opponentClaims} The burden is to compare replacement against supplementation, not against doing nothing.`
      };
    },
    async observe(event: DebateEvent): Promise<void> {
      observedTurns.push(event.turn.turn_id);
    }
  };
}
