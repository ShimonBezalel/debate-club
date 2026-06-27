import type { DebateAgent } from "../agents/interface.js";
import type { DebateJudge } from "../judges/interface.js";
import { aggregateVotes } from "../scoring/aggregate.js";
import type { CompletedMatch, Conjecture, DebateProtocol, DebateTurn, Side } from "../types/core.js";

export interface RunMatchInput {
  protocol: DebateProtocol;
  conjecture: Conjecture;
  agents: Record<Side, DebateAgent>;
  judges: DebateJudge[];
  matchId: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.33);
}

export async function runMatch(input: RunMatchInput): Promise<CompletedMatch> {
  if (input.conjecture.evidence_mode !== "no_external_info") {
    throw new Error(`Milestone 0.1 can execute only no_external_info debates, received '${input.conjecture.evidence_mode}'.`);
  }

  await input.agents.pro.prepare({
    match_id: input.matchId,
    conjecture: input.conjecture,
    protocol: input.protocol,
    side: "pro",
    opponent: "con",
    evidence_mode: input.conjecture.evidence_mode
  });
  await input.agents.con.prepare({
    match_id: input.matchId,
    conjecture: input.conjecture,
    protocol: input.protocol,
    side: "con",
    opponent: "pro",
    evidence_mode: input.conjecture.evidence_mode
  });

  const transcript: DebateTurn[] = [];
  for (const turn of input.protocol.turns) {
    const agent = input.agents[turn.speaker];
    const started = Date.now();
    const move = await agent.speak({
      match_id: input.matchId,
      conjecture: input.conjecture,
      protocol: input.protocol,
      side: turn.speaker,
      turn,
      transcript: [...transcript]
    }, { time_sec: turn.time_sec, max_tokens: input.protocol.max_turn_tokens });
    const completed = Date.now();
    const debateTurn: DebateTurn = {
      ...move,
      turn_id: turn.id,
      speaker: turn.speaker,
      phase: turn.phase,
      started_at: new Date(started).toISOString(),
      completed_at: new Date(completed).toISOString(),
      time_used_sec: Math.max(0, (completed - started) / 1000),
      tokens_estimate: estimateTokens(move.text)
    };
    transcript.push(debateTurn);
    await input.agents.pro.observe({ type: "turn_completed", turn: debateTurn });
    await input.agents.con.observe({ type: "turn_completed", turn: debateTurn });
  }

  const baseMatch: CompletedMatch = {
    match_id: input.matchId,
    created_at: nowIso(),
    conjecture: input.conjecture,
    protocol: input.protocol,
    agents: {
      pro: input.agents.pro.card,
      con: input.agents.con.card
    },
    transcript,
    judge_votes: [],
    result: { winner: "tie", judge_split: { pro: 0, con: 0, tie: 0 }, confidence_mean: 0, confidence_variance: 0, flags: [] }
  };

  const judge_votes = [];
  for (const judge of input.judges) {
    judge_votes.push(await judge.judge(baseMatch));
  }
  const result = aggregateVotes(judge_votes);
  return { ...baseMatch, judge_votes, result };
}
