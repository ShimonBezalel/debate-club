import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";
import { conjectureSchema, truthTypeSchema } from "../schemas/conjecture.js";
import type { Conjecture } from "../types/core.js";

export const EVERGREEN_DOMAINS = [
  "ai_software_systems",
  "science_epistemology",
  "education_learning",
  "organizations_work",
  "technology_governance",
  "creativity_culture",
  "cities_environment",
  "philosophy_ethics"
] as const;

const evergreenDomainSchema = z.enum(EVERGREEN_DOMAINS);
const catalogSourceSchema = z.object({
  version: z.literal("evergreen-v1"),
  defaults: z.object({
    stance_mode: z.literal("forced_random"),
    evidence_mode: z.literal("no_external_info"),
    allowed_tools: z.object({
      web: z.literal(false),
      calculator: z.literal(false),
      evidence_pack: z.literal(false)
    })
  }),
  domains: z.array(z.object({
    id: evergreenDomainSchema,
    rubric_notes: z.array(z.string().min(1)).min(2).max(4),
    topics: z.array(z.object({
      id: z.string().regex(/^[a-z0-9_]+$/),
      statement: z.string().min(20),
      truth_type: truthTypeSchema,
      short_context: z.string().min(20)
    })).length(12)
  })).length(EVERGREEN_DOMAINS.length)
});

export function validateEvergreenCatalog(value: unknown): Conjecture[] {
  const catalog = z.array(conjectureSchema).min(1).parse(value);
  const seen = new Set<string>();
  for (const topic of catalog) {
    if (seen.has(topic.id)) {
      throw new Error(`Duplicate evergreen topic id '${topic.id}'.`);
    }
    seen.add(topic.id);
    if (!/^[a-z0-9_]+$/.test(topic.id)) {
      throw new Error(`Evergreen topic id '${topic.id}' must contain only lowercase letters, digits, and underscores.`);
    }
    if (!EVERGREEN_DOMAINS.includes(topic.domain as (typeof EVERGREEN_DOMAINS)[number])) {
      throw new Error(`Unsupported evergreen topic domain '${topic.domain}'.`);
    }
    if (topic.evidence_mode !== "no_external_info") {
      throw new Error(`Evergreen topic '${topic.id}' must use no_external_info.`);
    }
    if (topic.allowed_tools.web || topic.allowed_tools.calculator || topic.allowed_tools.evidence_pack) {
      throw new Error(`Evergreen topic '${topic.id}' must disable all tools.`);
    }
    if (topic.rubric_notes.length < 2 || topic.rubric_notes.length > 4) {
      throw new Error(`Evergreen topic '${topic.id}' must have two to four rubric notes.`);
    }
  }
  return catalog;
}

export async function loadEvergreenCatalog(path: string): Promise<Conjecture[]> {
  const source = catalogSourceSchema.parse(parse(await readFile(path, "utf8")));
  const actualDomainOrder = source.domains.map((domain) => domain.id);
  if (actualDomainOrder.some((domain, index) => domain !== EVERGREEN_DOMAINS[index])) {
    throw new Error(`Evergreen domain order must be ${EVERGREEN_DOMAINS.join(", ")}.`);
  }
  const catalog = source.domains.flatMap((domain) => domain.topics.map((topic): Conjecture => ({
    id: topic.id,
    statement: topic.statement,
    domain: domain.id,
    truth_type: topic.truth_type,
    stance_mode: source.defaults.stance_mode,
    evidence_mode: source.defaults.evidence_mode,
    allowed_tools: { ...source.defaults.allowed_tools },
    background: { short_context: topic.short_context },
    rubric_notes: [...domain.rubric_notes]
  })));
  if (catalog.length !== 96) {
    throw new Error(`Evergreen catalog must contain 96 topics, received ${catalog.length}.`);
  }
  return validateEvergreenCatalog(catalog);
}
