import type { CompletedMatch, JudgeCard, JudgeVote } from "../types/core.js";

export interface DebateJudge {
  card: JudgeCard;
  judge(match: CompletedMatch): Promise<JudgeVote>;
}
