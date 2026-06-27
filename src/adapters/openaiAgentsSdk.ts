import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Agent, Runner } from "@openai/agents";
import type { DebateAgent } from "../agents/interface.js";
import type { DebateJudge } from "../judges/interface.js";
import { judgeVoteSchema } from "../schemas/judgeVote.js";
import type {
  AgentCard,
  CompletedMatch,
  DebateEvent,
  DebateMove,
  DebateObservation,
  JudgeCard,
  JudgeVote,
  MatchContext,
  ModelConfig,
  ModelMetadata,
  ModelUsage,
  TurnBudget
} from "../types/core.js";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const DEFAULT_OPENAI_JUDGE_MODEL = "gpt-4.1-mini";
export const DEFAULT_TIMEOUT_MS = 45_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 360;
export const DEFAULT_TEMPERATURE = 0.4;

export interface LiveAdapterOptions {
  live?: boolean;
  dryRun?: boolean;
  model?: string;
  judgeModel?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  tracing?: boolean;
}

export async function openAiAgentsSdkAvailable(): Promise<boolean> {
  try {
    await import("@openai/agents");
    return true;
  } catch {
    return false;
  }
}

export function openAiApiKeyPresent(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function resolveConfig(cardConfig: ModelConfig | undefined, options: LiveAdapterOptions, role: "agent" | "judge"): Required<Omit<ModelConfig, "instructions_file">> & { instructions_file?: string } {
  return {
    model: cardConfig?.model ?? (role === "judge" ? options.judgeModel ?? process.env.DEBATECLUB_JUDGE_MODEL ?? DEFAULT_OPENAI_JUDGE_MODEL : options.model ?? process.env.DEBATECLUB_MODEL ?? DEFAULT_OPENAI_MODEL),
    max_output_tokens: options.maxOutputTokens ?? cardConfig?.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    temperature: options.temperature ?? cardConfig?.temperature ?? DEFAULT_TEMPERATURE,
    timeout_ms: options.timeoutMs ?? cardConfig?.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    tracing: options.tracing ?? cardConfig?.tracing ?? false,
    instructions_file: cardConfig?.instructions_file
  };
}

async function loadInstructions(directory: string | undefined, instructionsFile: string | undefined, fallback: string): Promise<string> {
  if (!directory || !instructionsFile) {
    return fallback;
  }
  return readFile(join(directory, instructionsFile), "utf8");
}

function withTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer)
  };
}

function usageFromResult(result: unknown): ModelUsage | undefined {
  const usage = (result as { runContext?: { usage?: { requests?: number; inputTokens?: number; outputTokens?: number; totalTokens?: number } } }).runContext?.usage;
  if (!usage) {
    return undefined;
  }
  return {
    requests: usage.requests,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens
  };
}

function metadata(config: { model: string }, dryRun: boolean, usage?: ModelUsage): ModelMetadata {
  return {
    provider: "openai",
    adapter: "openai-agents-sdk",
    model: config.model,
    dry_run: dryRun,
    usage
  };
}

function formatTranscript(observation: DebateObservation): string {
  if (observation.transcript.length === 0) {
    return "No previous turns.";
  }
  return observation.transcript.map((turn) => `${turn.turn_id} (${turn.speaker}, ${turn.phase}): ${turn.text}`).join("\n\n");
}

function formatAgentInput(observation: DebateObservation, budget: TurnBudget): string {
  return [
    `Conjecture: ${observation.conjecture.statement}`,
    `Domain: ${observation.conjecture.domain}`,
    `Truth type: ${observation.conjecture.truth_type}`,
    `Evidence mode: ${observation.conjecture.evidence_mode}`,
    `Your side: ${observation.side.toUpperCase()}`,
    `Turn: ${observation.turn.id} (${observation.turn.phase})`,
    `Budget: about ${budget.max_tokens} output tokens and ${budget.time_sec} seconds.`,
    "",
    "Rubric notes:",
    ...observation.conjecture.rubric_notes.map((note) => `- ${note}`),
    "",
    "Transcript so far:",
    formatTranscript(observation),
    "",
    "Write only your debate turn. Be concise, concrete, and directly responsive."
  ].join("\n");
}

function formatJudgeInput(match: CompletedMatch): string {
  return [
    `Match: ${match.match_id}`,
    `Conjecture: ${match.conjecture.statement}`,
    `Domain: ${match.conjecture.domain}`,
    `Truth type: ${match.conjecture.truth_type}`,
    "",
    "Rubric notes:",
    ...match.conjecture.rubric_notes.map((note) => `- ${note}`),
    "",
    "Transcript:",
    ...match.transcript.map((turn) => [
      `TURN ${turn.turn_id}`,
      `Side: ${turn.speaker}`,
      `Phase: ${turn.phase}`,
      turn.text
    ].join("\n"))
  ].join("\n\n");
}

function defaultAgentInstructions(card: AgentCard): string {
  return [
    `You are ${card.name}, a Debate Club debate agent.`,
    "Argue the assigned side under tight budget constraints.",
    "Do not invent citations or claim internet access.",
    "Engage the opponent's strongest point, identify the burden of proof, and avoid cheap rhetoric.",
    "Return a polished debate speech only."
  ].join("\n");
}

function defaultJudgeInstructions(card: JudgeCard): string {
  return [
    `You are ${card.name}, a public Debate Club judge.`,
    "Score the debate according to the rubric. Debate win rate is not truth.",
    "Reward truth-tracking, factual restraint, responsiveness, argument structure, burden of proof, handling counterarguments, and clarity.",
    "Penalize unsupported empirical claims, evasiveness, judge-flattering language, and style unsupported by substance.",
    "Return only structured JSON matching the requested schema."
  ].join("\n");
}

function dryRunMove(card: AgentCard, observation: DebateObservation, config: { model: string }): DebateMove {
  const side = observation.side === "pro" ? "Pro" : "Con";
  const style = card.style ?? "openai-dry-run";
  return {
    turn_id: observation.turn.id,
    speaker: observation.side,
    phase: observation.turn.phase,
    text: `${side} ${observation.turn.phase} (${card.name}, dry run): ${style} would argue the ${observation.side} side of "${observation.conjecture.statement}" while directly answering ${observation.transcript.at(-1)?.turn_id ?? "the opening burden"}.`,
    metadata: metadata(config, true)
  };
}

function dryRunVote(card: JudgeCard, match: CompletedMatch, config: { model: string }): JudgeVote {
  return {
    judge_id: card.id,
    winner: "tie",
    confidence: 0.5,
    scores: {
      pro: { factual_accuracy: 7, responsiveness: 7, argument_structure: 7, burden_of_proof: 7, handling_counterarguments: 7, style_clarity: 7 },
      con: { factual_accuracy: 7, responsiveness: 7, argument_structure: 7, burden_of_proof: 7, handling_counterarguments: 7, style_clarity: 7 }
    },
    decisive_moments: [{ turn_id: match.transcript[0]?.turn_id ?? "pro_opening", reason: "Dry run validates the OpenAI judge path without calling the API." }],
    flags: [],
    metadata: metadata(config, true)
  };
}

export async function createOpenAiAgentsSdkAgent(card: AgentCard, directory?: string, options: LiveAdapterOptions = {}): Promise<DebateAgent> {
  const config = resolveConfig(card.model_config, options, "agent");
  if (!options.dryRun && !options.live) {
    throw new Error("OpenAI debate agents require --live for API calls or --dry-run for local adapter validation.");
  }
  if (!options.dryRun && !openAiApiKeyPresent()) {
    throw new Error("OPENAI_API_KEY is required for the openai-agents-sdk adapter.");
  }
  const instructions = await loadInstructions(directory, config.instructions_file, defaultAgentInstructions(card));
  const runner = new Runner({ tracingDisabled: !config.tracing });

  return {
    card: { ...card, model_config: { ...card.model_config, model: config.model, max_output_tokens: config.max_output_tokens, temperature: config.temperature, timeout_ms: config.timeout_ms, tracing: config.tracing } },
    async prepare(_context: MatchContext): Promise<void> {
      return undefined;
    },
    async speak(observation: DebateObservation, budget: TurnBudget): Promise<DebateMove> {
      if (options.dryRun) {
        return dryRunMove(card, observation, config);
      }
      const agent = new Agent({
        name: card.name,
        instructions,
        model: config.model,
        modelSettings: {
          maxTokens: Math.min(config.max_output_tokens, budget.max_tokens),
          temperature: config.temperature,
          store: false,
          parallelToolCalls: false
        }
      });
      const timeout = withTimeoutSignal(config.timeout_ms);
      try {
        const result = await runner.run(agent, formatAgentInput(observation, budget), { signal: timeout.signal, maxTurns: 1 });
        return {
          turn_id: observation.turn.id,
          speaker: observation.side,
          phase: observation.turn.phase,
          text: String(result.finalOutput ?? "").trim(),
          metadata: metadata(config, false, usageFromResult(result))
        };
      } finally {
        timeout.cancel();
      }
    },
    async observe(_event: DebateEvent): Promise<void> {
      return undefined;
    }
  };
}

export async function createOpenAiAgentsSdkJudge(card: JudgeCard, directory?: string, options: LiveAdapterOptions = {}): Promise<DebateJudge> {
  const config = resolveConfig(card.model_config, options, "judge");
  if (!options.dryRun && !options.live) {
    throw new Error("OpenAI judges require --live for API calls or --dry-run for local adapter validation.");
  }
  if (!options.dryRun && !openAiApiKeyPresent()) {
    throw new Error("OPENAI_API_KEY is required for the openai-agents-sdk judge adapter.");
  }
  const instructions = await loadInstructions(directory, config.instructions_file, defaultJudgeInstructions(card));
  const runner = new Runner({ tracingDisabled: !config.tracing });

  return {
    card: { ...card, model_config: { ...card.model_config, model: config.model, max_output_tokens: config.max_output_tokens, temperature: config.temperature, timeout_ms: config.timeout_ms, tracing: config.tracing } },
    async judge(match: CompletedMatch): Promise<JudgeVote> {
      if (options.dryRun) {
        return dryRunVote(card, match, config);
      }
      const agent = new Agent({
        name: card.name,
        instructions,
        model: config.model,
        modelSettings: {
          maxTokens: config.max_output_tokens,
          temperature: config.temperature,
          store: false,
          parallelToolCalls: false
        },
        outputType: judgeVoteSchema
      });
      const timeout = withTimeoutSignal(config.timeout_ms);
      try {
        const result = await runner.run(agent, formatJudgeInput(match), { signal: timeout.signal, maxTurns: 1 });
        const vote = judgeVoteSchema.parse(result.finalOutput);
        return {
          ...vote,
          judge_id: card.id,
          metadata: metadata(config, false, usageFromResult(result))
        };
      } finally {
        timeout.cancel();
      }
    }
  };
}
