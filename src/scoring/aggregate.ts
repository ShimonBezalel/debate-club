import type { DebateWinner, JudgeVote, ScoreSummary } from "../types/core.js";

function variance(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function aggregateVotes(votes: JudgeVote[]): ScoreSummary {
  const judge_split: Record<DebateWinner, number> = { pro: 0, con: 0, tie: 0 };
  for (const vote of votes) {
    judge_split[vote.winner] += 1;
  }
  const winner = (Object.entries(judge_split).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "tie") as DebateWinner;
  const confidences = votes.map((vote) => vote.confidence);
  const confidence_mean = confidences.length === 0 ? 0 : confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return {
    winner,
    judge_split,
    confidence_mean,
    confidence_variance: variance(confidences, confidence_mean),
    flags: votes.flatMap((vote) => vote.flags)
  };
}
