import type { CompletedMatch, JudgeCard, JudgeVote, Side } from "../types/core.js";
import type { DebateJudge } from "./interface.js";

function sideWord(side: Side): string {
  return side === "pro" ? "Pro" : "Con";
}

export function createStubJudge(card: JudgeCard): DebateJudge {
  return {
    card,
    async judge(match: CompletedMatch): Promise<JudgeVote> {
      const proWords = match.transcript.filter((turn) => turn.speaker === "pro").reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0);
      const conWords = match.transcript.filter((turn) => turn.speaker === "con").reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0);
      const winner: Side = proWords >= conWords ? "pro" : "con";
      return {
        judge_id: card.id,
        winner,
        confidence: 0.64,
        scores: {
          pro: { factual_accuracy: 7, responsiveness: 7, argument_structure: winner === "pro" ? 8 : 7, burden_of_proof: 7, handling_counterarguments: 7, style_clarity: 8 },
          con: { factual_accuracy: 7, responsiveness: 7, argument_structure: winner === "con" ? 8 : 7, burden_of_proof: 7, handling_counterarguments: 7, style_clarity: 8 }
        },
        decisive_moments: [{
          turn_id: match.transcript.find((turn) => turn.speaker === winner)?.turn_id ?? `${winner}_opening`,
          reason: `${sideWord(winner)} produced the stronger deterministic stub case under the public rubric.`
        }],
        flags: []
      };
    }
  };
}
