export type Side = "pro" | "con";
export type DebateWinner = Side | "tie";
export type EvidenceMode = "no_external_info" | "provided_packet_only" | "web_allowed_with_citations" | "tools_allowed";
export type TruthType = "factual_known" | "factual_uncertain" | "normative" | "policy" | "philosophical" | "technical_design" | "strategic";
export type DebatePhase = "opening" | "rebuttal" | "cross_exam" | "answer" | "closing";

export interface ModelUsage {
  requests?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface ProviderTraceMetadata {
  requested: boolean;
  enabled: boolean;
  provider: "openai";
  trace_id?: string;
  agent_name: string;
  model: string;
  started_at: string;
  platform_url?: string;
  response_storage: "disabled";
}

export interface ModelMetadata {
  provider?: "openai" | "stub";
  adapter?: "stub" | "openai-agents-sdk";
  model?: string;
  dry_run?: boolean;
  usage?: ModelUsage;
  trace?: ProviderTraceMetadata;
}

export interface ModelConfig {
  model?: string;
  max_output_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  instructions_file?: string;
  tracing?: boolean;
}

export interface TurnBudget {
  time_sec: number;
  max_tokens: number;
}

export interface DebateMove {
  turn_id: string;
  speaker: Side;
  phase: DebatePhase;
  text: string;
  metadata?: ModelMetadata;
}

export interface DebateTurn extends DebateMove {
  started_at: string;
  completed_at: string;
  time_used_sec: number;
  tokens_estimate: number;
}

export interface DebateEvent {
  type: "turn_completed";
  turn: DebateTurn;
}

export interface MatchContext {
  match_id: string;
  conjecture: Conjecture;
  protocol: DebateProtocol;
  side: Side;
  opponent: Side;
  evidence_mode: EvidenceMode;
}

export interface DebateObservation {
  match_id: string;
  conjecture: Conjecture;
  protocol: DebateProtocol;
  side: Side;
  turn: ProtocolTurn;
  transcript: DebateTurn[];
}

export interface Conjecture {
  id: string;
  statement: string;
  domain: string;
  truth_type: TruthType;
  stance_mode: "forced_random" | "assigned";
  evidence_mode: EvidenceMode;
  allowed_tools: {
    web: boolean;
    calculator: boolean;
    evidence_pack: boolean;
  };
  background?: {
    short_context?: string;
  };
  featured?: boolean;
  rubric_notes: string[];
}

export interface ProtocolTurn {
  id: string;
  speaker: Side;
  phase: DebatePhase;
  time_sec: number;
}

export interface DebateProtocol {
  id: "classic_v1";
  prep_time_sec: number;
  max_turn_tokens: number;
  turns: ProtocolTurn[];
}

export interface AgentCard {
  name: string;
  version: string;
  description: string;
  adapter: "stub" | "openai-agents-sdk";
  private: boolean;
  supports: EvidenceMode[];
  input_modes: string[];
  stance?: Side;
  style?: string;
  model_config?: ModelConfig;
  resource_limits: {
    max_wall_time_sec: number;
    max_tokens_per_turn: number;
  };
}

export interface JudgeCard {
  id: string;
  name: string;
  version: string;
  adapter: "stub" | "openai-agents-sdk";
  public: boolean;
  rubric: RubricWeights;
  model_config?: ModelConfig;
}

export interface JudgePanel {
  id: string;
  judges: string[];
}

export interface RubricWeights {
  factual_accuracy: number;
  responsiveness: number;
  argument_structure: number;
  burden_of_proof: number;
  handling_counterarguments: number;
  style_clarity: number;
}

export interface RubricScores {
  factual_accuracy: number;
  responsiveness: number;
  argument_structure: number;
  burden_of_proof: number;
  handling_counterarguments: number;
  style_clarity: number;
}

export interface JudgeVote {
  judge_id: string;
  winner: DebateWinner;
  confidence: number;
  scores: Record<Side, RubricScores>;
  decisive_moments: Array<{ turn_id: string; reason: string }>;
  flags: Array<{ side: Side; type: string; severity: "low" | "medium" | "high"; quote: string }>;
  metadata?: ModelMetadata;
}

export interface ScoreSummary {
  winner: DebateWinner;
  judge_split: Record<DebateWinner, number>;
  confidence_mean: number;
  confidence_variance: number;
  flags: JudgeVote["flags"];
}

export interface CompletedMatch {
  match_id: string;
  created_at: string;
  conjecture: Conjecture;
  protocol: DebateProtocol;
  agents: Record<Side, AgentCard>;
  transcript: DebateTurn[];
  judge_votes: JudgeVote[];
  result: ScoreSummary;
}
