import { z } from "zod";
import { evidenceModeSchema } from "./conjecture.js";

export const rubricWeightsSchema = z.object({
  factual_accuracy: z.number().min(0).max(1),
  responsiveness: z.number().min(0).max(1),
  argument_structure: z.number().min(0).max(1),
  burden_of_proof: z.number().min(0).max(1),
  handling_counterarguments: z.number().min(0).max(1),
  style_clarity: z.number().min(0).max(1)
});

export const modelConfigSchema = z.object({
  model: z.string().min(1).optional(),
  max_output_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeout_ms: z.number().int().positive().optional(),
  instructions_file: z.string().min(1).optional(),
  tracing: z.boolean().optional()
});

export const agentCardSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  adapter: z.enum(["stub", "openai-agents-sdk"]),
  private: z.boolean(),
  supports: z.array(evidenceModeSchema),
  input_modes: z.array(z.string().min(1)),
  stance: z.enum(["pro", "con"]).optional(),
  style: z.string().optional(),
  model_config: modelConfigSchema.optional(),
  resource_limits: z.object({
    max_wall_time_sec: z.number().int().positive(),
    max_tokens_per_turn: z.number().int().positive()
  })
});

export const judgeCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  adapter: z.enum(["stub", "openai-agents-sdk"]),
  public: z.boolean(),
  rubric: rubricWeightsSchema,
  model_config: modelConfigSchema.optional()
});

export const judgePanelSchema = z.object({
  id: z.string().min(1),
  judges: z.array(z.string().min(1)).min(1)
});
