import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompletedMatch, ModelUsage, Side } from "../types/core.js";
import { PUBLIC_DB_SCHEMA_VERSION, type PublicDbManifest, type PublicMatchSummary } from "./schema.js";

const SOURCE_REPO_URL = "https://github.com/ShimonBezalel/debate-club";

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function renderReadme(manifest: PublicDbManifest): string {
  return `# Debate Club Public Database

This directory is a static, open-source database of valid Debate Club matches. It is generated from the canonical \`matches/\` ledger so anyone can fork, diff, cite, and replay the public artifacts without relying on a hosted database.

- Schema version: ${manifest.schema_version}
- Matches: ${manifest.match_count}
- Ledger through: ${manifest.ledger_through}
- Source project: ${manifest.source_repo}

## Schema

| Path | Contents |
| --- | --- |
| \`index.json\` | Database manifest, schema version, ledger timestamp, and aggregate file paths. |
| \`matches.json\` | Searchable match summaries for viewers and indexes. |
| \`agents.json\` | Public agent metadata and match participation. |
| \`judges.json\` | Public judge metadata, models, matches, and vote counts. |
| \`conjectures.json\` | Conjecture catalog with domains, truth types, and match IDs. |
| \`matches/<match-id>.json\` | Complete canonical match object plus public artifact links. |
| \`matches/<match-id>.transcript.md\` | Human-readable transcript. |
| \`matches/<match-id>.scorecard.md\` | Human-readable result and judge summary. |

## Use

Serve this directory as static files or consume it directly from a local clone. Start with \`index.json\`, load \`matches.json\` for discovery, then open the per-match JSON or Markdown artifacts.

Regenerate and validate:

\`\`\`bash
npm run cli -- ledger export-public-db --matches matches --out public-db
npm run cli -- ledger validate-public-db --db public-db
\`\`\`

When citing a match, use its stable \`match_id\`, source repository folder, and \`created_at\` timestamp.
`;
}

function requireCompletedMatch(value: unknown, source: string): CompletedMatch {
  const match = value as Partial<CompletedMatch>;
  if (
    typeof match.match_id !== "string"
    || !/^[A-Za-z0-9._-]+$/.test(match.match_id)
    || typeof match.created_at !== "string"
    || typeof match.conjecture?.statement !== "string"
    || typeof match.agents?.pro?.name !== "string"
    || typeof match.agents?.con?.name !== "string"
    || !Array.isArray(match.transcript)
    || !Array.isArray(match.judge_votes)
    || typeof match.result?.winner !== "string"
  ) {
    throw new Error(`Invalid completed match artifact: ${source}`);
  }
  return match as CompletedMatch;
}

function sumUsage(matches: Array<ModelUsage | undefined>): Required<ModelUsage> {
  return matches.reduce<Required<ModelUsage>>((total, usage) => ({
    requests: total.requests + (usage?.requests ?? 0),
    input_tokens: total.input_tokens + (usage?.input_tokens ?? 0),
    output_tokens: total.output_tokens + (usage?.output_tokens ?? 0),
    total_tokens: total.total_tokens + (usage?.total_tokens ?? 0)
  }), { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0 });
}

function agentRef(match: CompletedMatch, side: Side) {
  const card = match.agents[side];
  const turnModel = match.transcript.find((turn) => turn.speaker === side)?.metadata?.model;
  return {
    name: card.name,
    version: card.version,
    adapter: card.adapter,
    model: turnModel ?? card.model_config?.model
  };
}

function summarizeMatch(match: CompletedMatch): PublicMatchSummary {
  const sourceFolder = `${SOURCE_REPO_URL}/tree/main/matches/${encodeURIComponent(match.match_id)}`;
  return {
    match_id: match.match_id,
    created_at: match.created_at,
    featured: Boolean(match.conjecture.featured),
    conjecture: {
      id: match.conjecture.id,
      statement: match.conjecture.statement,
      domain: match.conjecture.domain,
      truth_type: match.conjecture.truth_type,
      evidence_mode: match.conjecture.evidence_mode
    },
    protocol_id: match.protocol.id,
    pro_agent: agentRef(match, "pro"),
    con_agent: agentRef(match, "con"),
    judges: match.judge_votes.map((vote) => ({
      id: vote.judge_id,
      provider: vote.metadata?.provider,
      model: vote.metadata?.model
    })),
    result: {
      winner: match.result.winner,
      judge_split: {
        pro: match.result.judge_split.pro ?? 0,
        con: match.result.judge_split.con ?? 0,
        tie: match.result.judge_split.tie ?? 0
      },
      confidence_mean: match.result.confidence_mean
    },
    usage: sumUsage([
      ...match.transcript.map((turn) => turn.metadata?.usage),
      ...match.judge_votes.map((vote) => vote.metadata?.usage)
    ]),
    paths: {
      detail: `matches/${match.match_id}.json`,
      transcript: `matches/${match.match_id}.transcript.md`,
      scorecard: `matches/${match.match_id}.scorecard.md`,
      source: sourceFolder
    }
  };
}

async function loadMatches(matchesRoot: string): Promise<CompletedMatch[]> {
  const entries = await readdir(matchesRoot, { withFileTypes: true });
  const matches: CompletedMatch[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "failed" || entry.name === "tmp") {
      continue;
    }
    const path = join(matchesRoot, entry.name, "match.json");
    const raw = await readFile(path, "utf8").catch(() => undefined);
    if (!raw) {
      continue;
    }
    matches.push(requireCompletedMatch(JSON.parse(raw), path));
  }
  return matches.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function aggregateAgents(matches: CompletedMatch[]) {
  const agents = new Map<string, {
    name: string;
    version: string;
    description: string;
    adapter: string;
    private: boolean;
    models: Set<string>;
    match_ids: Set<string>;
    sides: Set<Side>;
  }>();
  for (const match of matches) {
    for (const side of ["pro", "con"] as const) {
      const card = match.agents[side];
      const current = agents.get(card.name) ?? {
        name: card.name,
        version: card.version,
        description: card.description,
        adapter: card.adapter,
        private: card.private,
        models: new Set<string>(),
        match_ids: new Set<string>(),
        sides: new Set<Side>()
      };
      const model = agentRef(match, side).model;
      if (model) {
        current.models.add(model);
      }
      current.match_ids.add(match.match_id);
      current.sides.add(side);
      agents.set(card.name, current);
    }
  }
  return [...agents.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((agent) => ({
      ...agent,
      models: [...agent.models].sort(),
      match_count: agent.match_ids.size,
      match_ids: [...agent.match_ids].sort(),
      sides: [...agent.sides].sort()
    }));
}

function aggregateJudges(matches: CompletedMatch[]) {
  const judges = new Map<string, {
    id: string;
    providers: Set<string>;
    models: Set<string>;
    match_ids: Set<string>;
    votes: { pro: number; con: number; tie: number };
  }>();
  for (const match of matches) {
    for (const vote of match.judge_votes) {
      const current = judges.get(vote.judge_id) ?? {
        id: vote.judge_id,
        providers: new Set<string>(),
        models: new Set<string>(),
        match_ids: new Set<string>(),
        votes: { pro: 0, con: 0, tie: 0 }
      };
      if (vote.metadata?.provider) {
        current.providers.add(vote.metadata.provider);
      }
      if (vote.metadata?.model) {
        current.models.add(vote.metadata.model);
      }
      current.match_ids.add(match.match_id);
      current.votes[vote.winner] += 1;
      judges.set(vote.judge_id, current);
    }
  }
  return [...judges.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((judge) => ({
      ...judge,
      providers: [...judge.providers].sort(),
      models: [...judge.models].sort(),
      match_count: judge.match_ids.size,
      match_ids: [...judge.match_ids].sort()
    }));
}

function aggregateConjectures(matches: CompletedMatch[]) {
  const conjectures = new Map<string, {
    id: string;
    statement: string;
    domain: string;
    truth_type: string;
    evidence_mode: string;
    featured: boolean;
    match_ids: Set<string>;
  }>();
  for (const match of matches) {
    const current = conjectures.get(match.conjecture.id) ?? {
      id: match.conjecture.id,
      statement: match.conjecture.statement,
      domain: match.conjecture.domain,
      truth_type: match.conjecture.truth_type,
      evidence_mode: match.conjecture.evidence_mode,
      featured: Boolean(match.conjecture.featured),
      match_ids: new Set<string>()
    };
    current.featured ||= Boolean(match.conjecture.featured);
    current.match_ids.add(match.match_id);
    conjectures.set(match.conjecture.id, current);
  }
  return [...conjectures.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((conjecture) => ({
      ...conjecture,
      match_count: conjecture.match_ids.size,
      match_ids: [...conjecture.match_ids].sort()
    }));
}

export async function exportPublicDb(matchesRoot: string, outRoot: string): Promise<PublicDbManifest> {
  const matches = await loadMatches(matchesRoot);
  await rm(outRoot, { recursive: true, force: true });
  await mkdir(join(outRoot, "matches"), { recursive: true });

  const summaries = matches.map(summarizeMatch);
  for (const [index, match] of matches.entries()) {
    const summary = summaries[index]!;
    await writeFile(join(outRoot, summary.paths.detail), json({
      schema_version: PUBLIC_DB_SCHEMA_VERSION,
      source_url: summary.paths.source,
      paths: {
        transcript: summary.paths.transcript,
        scorecard: summary.paths.scorecard
      },
      match
    }));
    await copyFile(join(matchesRoot, match.match_id, "transcript.md"), join(outRoot, summary.paths.transcript));
    await copyFile(join(matchesRoot, match.match_id, "scorecard.md"), join(outRoot, summary.paths.scorecard));
  }

  const manifest: PublicDbManifest = {
    schema_version: PUBLIC_DB_SCHEMA_VERSION,
    ledger_through: matches.at(-1)?.created_at ?? "1970-01-01T00:00:00.000Z",
    source_repo: SOURCE_REPO_URL,
    match_count: matches.length,
    default_match_id: [...summaries].reverse().find((match) => match.featured)?.match_id ?? summaries.at(-1)?.match_id,
    files: {
      matches: "matches.json",
      agents: "agents.json",
      judges: "judges.json",
      conjectures: "conjectures.json"
    }
  };
  await Promise.all([
    writeFile(join(outRoot, "index.json"), json(manifest)),
    writeFile(join(outRoot, "matches.json"), json(summaries)),
    writeFile(join(outRoot, "agents.json"), json(aggregateAgents(matches))),
    writeFile(join(outRoot, "judges.json"), json(aggregateJudges(matches))),
    writeFile(join(outRoot, "conjectures.json"), json(aggregateConjectures(matches))),
    writeFile(join(outRoot, "README.md"), renderReadme(manifest))
  ]);
  return manifest;
}
