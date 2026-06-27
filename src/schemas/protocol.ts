import { z } from "zod";

export const protocolTurnSchema = z.object({
  id: z.string().min(1),
  speaker: z.enum(["pro", "con"]),
  phase: z.enum(["opening", "rebuttal", "cross_exam", "answer", "closing"]),
  time_sec: z.number().int().positive()
});

export const protocolSchema = z.object({
  id: z.literal("classic_v1"),
  prep_time_sec: z.number().int().nonnegative(),
  max_turn_tokens: z.number().int().positive(),
  turns: z.array(protocolTurnSchema)
});
