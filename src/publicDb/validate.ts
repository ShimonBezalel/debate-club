import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  publicAgentsSchema,
  publicConjecturesSchema,
  publicDbManifestSchema,
  publicJudgesSchema,
  publicMatchDetailSchema,
  publicMatchSummarySchema
} from "./schema.js";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export interface PublicDbValidation {
  valid: true;
  match_count: number;
}

export async function validatePublicDb(dbRoot: string): Promise<PublicDbValidation> {
  const manifest = publicDbManifestSchema.parse(await readJson(join(dbRoot, "index.json")));
  const matches = publicMatchSummarySchema.array().parse(await readJson(join(dbRoot, manifest.files.matches)));
  if (manifest.match_count !== matches.length) {
    throw new Error(`Public DB match_count is ${manifest.match_count}, but matches.json contains ${matches.length}.`);
  }
  await Promise.all([
    publicAgentsSchema.parseAsync(await readJson(join(dbRoot, manifest.files.agents))),
    publicJudgesSchema.parseAsync(await readJson(join(dbRoot, manifest.files.judges))),
    publicConjecturesSchema.parseAsync(await readJson(join(dbRoot, manifest.files.conjectures)))
  ]);
  const ids = new Set<string>();
  for (const summary of matches) {
    if (ids.has(summary.match_id)) {
      throw new Error(`Public DB contains duplicate match_id '${summary.match_id}'.`);
    }
    ids.add(summary.match_id);
    const detail = publicMatchDetailSchema.parse(await readJson(join(dbRoot, summary.paths.detail)));
    if (detail.match.match_id !== summary.match_id) {
      throw new Error(`Public DB detail mismatch for '${summary.match_id}'.`);
    }
    await Promise.all([
      access(join(dbRoot, summary.paths.transcript)),
      access(join(dbRoot, summary.paths.scorecard))
    ]);
  }
  if (manifest.default_match_id && !ids.has(manifest.default_match_id)) {
    throw new Error(`Public DB default_match_id '${manifest.default_match_id}' is missing.`);
  }
  return { valid: true, match_count: matches.length };
}
