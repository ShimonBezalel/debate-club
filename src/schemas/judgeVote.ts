import { z } from "zod";

export const rubricScoresSchema = z.object({
  factual_accuracy: z.number().min(0).max(10),
  responsiveness: z.number().min(0).max(10),
  argument_structure: z.number().min(0).max(10),
  burden_of_proof: z.number().min(0).max(10),
  handling_counterarguments: z.number().min(0).max(10),
  style_clarity: z.number().min(0).max(10)
});

export const judgeVoteSchema = z.object({
  judge_id: z.string().min(1),
  winner: z.enum(["pro", "con", "tie"]),
  confidence: z.number().min(0).max(1),
  scores: z.object({
    pro: rubricScoresSchema,
    con: rubricScoresSchema
  }),
  decisive_moments: z.array(z.object({
    turn_id: z.string().min(1),
    reason: z.string().min(1)
  })),
  flags: z.array(z.object({
    side: z.enum(["pro", "con"]),
    type: z.string().min(1),
    severity: z.enum(["low", "medium", "high"]),
    quote: z.string()
  })),
  metadata: z.object({
    provider: z.enum(["openai", "stub"]).optional(),
    adapter: z.enum(["stub", "openai-agents-sdk"]).optional(),
    model: z.string().optional(),
    dry_run: z.boolean().optional(),
    usage: z.object({
      requests: z.number().optional(),
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      total_tokens: z.number().optional()
    }).optional(),
    trace: z.object({
      requested: z.boolean(),
      enabled: z.boolean(),
      provider: z.literal("openai"),
      trace_id: z.string().optional(),
      agent_name: z.string().min(1),
      model: z.string().min(1),
      started_at: z.string().datetime(),
      platform_url: z.string().url().optional(),
      response_storage: z.literal("disabled")
    }).optional()
  }).optional()
});

export const judgeModelOutputSchema = judgeVoteSchema.omit({ metadata: true });
