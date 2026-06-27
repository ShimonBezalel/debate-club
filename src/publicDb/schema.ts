import { z } from "zod";

export const PUBLIC_DB_SCHEMA_VERSION = "1.0" as const;

const publicAgentRefSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  adapter: z.string().min(1),
  model: z.string().min(1).optional()
});

const publicJudgeRefSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional()
});

export const publicMatchSummarySchema = z.object({
  match_id: z.string().min(1),
  created_at: z.string().datetime(),
  featured: z.boolean(),
  conjecture: z.object({
    id: z.string().min(1),
    statement: z.string().min(1),
    domain: z.string().min(1),
    truth_type: z.string().min(1),
    evidence_mode: z.string().min(1)
  }),
  protocol_id: z.string().min(1),
  pro_agent: publicAgentRefSchema,
  con_agent: publicAgentRefSchema,
  judges: z.array(publicJudgeRefSchema),
  result: z.object({
    winner: z.enum(["pro", "con", "tie"]),
    judge_split: z.object({
      pro: z.number().int().nonnegative(),
      con: z.number().int().nonnegative(),
      tie: z.number().int().nonnegative()
    }),
    confidence_mean: z.number()
  }),
  usage: z.object({
    requests: z.number().int().nonnegative(),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative()
  }),
  paths: z.object({
    detail: z.string().min(1),
    transcript: z.string().min(1),
    scorecard: z.string().min(1),
    source: z.string().url()
  })
});

export const publicDbManifestSchema = z.object({
  schema_version: z.literal(PUBLIC_DB_SCHEMA_VERSION),
  ledger_through: z.string().datetime(),
  source_repo: z.string().url(),
  match_count: z.number().int().nonnegative(),
  default_match_id: z.string().min(1).optional(),
  files: z.object({
    matches: z.literal("matches.json"),
    agents: z.literal("agents.json"),
    judges: z.literal("judges.json"),
    conjectures: z.literal("conjectures.json")
  })
});

export const publicMatchDetailSchema = z.object({
  schema_version: z.literal(PUBLIC_DB_SCHEMA_VERSION),
  source_url: z.string().url(),
  paths: z.object({
    transcript: z.string().min(1),
    scorecard: z.string().min(1)
  }),
  match: z.object({
    match_id: z.string().min(1),
    created_at: z.string().datetime(),
    conjecture: z.object({
      id: z.string().min(1),
      statement: z.string().min(1),
      domain: z.string().min(1),
      truth_type: z.string().min(1)
    }).passthrough(),
    agents: z.object({
      pro: z.object({ name: z.string().min(1) }).passthrough(),
      con: z.object({ name: z.string().min(1) }).passthrough()
    }),
    transcript: z.array(z.object({
      turn_id: z.string().min(1),
      speaker: z.enum(["pro", "con"]),
      phase: z.string().min(1),
      text: z.string(),
      time_used_sec: z.number(),
      tokens_estimate: z.number()
    }).passthrough()),
    judge_votes: z.array(z.object({
      judge_id: z.string().min(1),
      winner: z.enum(["pro", "con", "tie"]),
      confidence: z.number()
    }).passthrough()),
    result: z.object({
      winner: z.enum(["pro", "con", "tie"])
    }).passthrough()
  }).passthrough()
});

export const publicAgentsSchema = z.array(z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string(),
  adapter: z.string().min(1),
  private: z.boolean(),
  models: z.array(z.string().min(1)),
  match_count: z.number().int().nonnegative(),
  match_ids: z.array(z.string().min(1)),
  sides: z.array(z.enum(["pro", "con"]))
}));

export const publicJudgesSchema = z.array(z.object({
  id: z.string().min(1),
  providers: z.array(z.string().min(1)),
  models: z.array(z.string().min(1)),
  match_count: z.number().int().nonnegative(),
  match_ids: z.array(z.string().min(1)),
  votes: z.object({
    pro: z.number().int().nonnegative(),
    con: z.number().int().nonnegative(),
    tie: z.number().int().nonnegative()
  })
}));

export const publicConjecturesSchema = z.array(z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  domain: z.string().min(1),
  truth_type: z.string().min(1),
  evidence_mode: z.string().min(1),
  featured: z.boolean(),
  match_count: z.number().int().nonnegative(),
  match_ids: z.array(z.string().min(1))
}));

export type PublicDbManifest = z.infer<typeof publicDbManifestSchema>;
export type PublicMatchSummary = z.infer<typeof publicMatchSummarySchema>;
