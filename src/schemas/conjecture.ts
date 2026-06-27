import { z } from "zod";

export const truthTypeSchema = z.enum(["factual_known", "factual_uncertain", "normative", "policy", "philosophical", "technical_design", "strategic"]);
export const evidenceModeSchema = z.enum(["no_external_info", "provided_packet_only", "web_allowed_with_citations", "tools_allowed"]);

export const conjectureSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  domain: z.string().min(1),
  truth_type: truthTypeSchema,
  stance_mode: z.enum(["forced_random", "assigned"]),
  evidence_mode: evidenceModeSchema,
  allowed_tools: z.object({
    web: z.boolean(),
    calculator: z.boolean(),
    evidence_pack: z.boolean()
  }),
  background: z.object({
    short_context: z.string().optional()
  }).optional(),
  featured: z.boolean().optional(),
  rubric_notes: z.array(z.string())
});
