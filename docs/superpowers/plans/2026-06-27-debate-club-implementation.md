# Debate Club Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish Debate Club milestone 0.1: a TypeScript CLI that runs deterministic debate-agent matches, writes an open Git-backed match ledger, includes docs/site artifacts, and exposes an optional real SDK adapter boundary.

**Architecture:** The repo is a TypeScript package with small modules for schema loading, agent/judge interfaces, runner orchestration, scoring, artifact writing, ledger indexing, and CLI commands. The deterministic path uses stub agents and stub judges so tests, CI, and local validation require no network or API keys. Optional SDK code sits behind adapter files and environment checks so real model use never affects CI.

**Tech Stack:** Node.js, TypeScript, Vitest, Zod, YAML, Commander, tsx, GitHub Actions, GitHub CLI, optional `@openai/agents`.

---

## File Structure

Create or modify these files:

- `package.json`: scripts, CLI bin, runtime dependencies, dev dependencies.
- `tsconfig.json`: strict TypeScript settings for `src` and `tests`.
- `vitest.config.ts`: Vitest config.
- `.gitignore`: generated and secret file exclusions.
- `.npmignore`: package publication exclusions for local match outputs and private files.
- `LICENSE`: MIT license unless changed in `DECISIONS.md`.
- `src/index.ts`: public exports.
- `src/types/core.ts`: core domain types shared by runner, CLI, adapters, and tests.
- `src/schemas/conjecture.ts`: Zod schema for conjecture configs.
- `src/schemas/protocol.ts`: Zod schema for protocol configs.
- `src/schemas/cards.ts`: Zod schemas for agent cards, judge cards, and judge panels.
- `src/schemas/judgeVote.ts`: Zod schema for judge votes.
- `src/schemas/load.ts`: YAML/JSON file loading helpers.
- `src/agents/interface.ts`: `DebateAgent` interface and card loader.
- `src/agents/stubAgent.ts`: deterministic stub agent.
- `src/agents/loadAgent.ts`: local adapter selection by agent card.
- `src/judges/interface.ts`: `DebateJudge` interface.
- `src/judges/stubJudge.ts`: deterministic public judge.
- `src/judges/loadPanel.ts`: judge panel loader.
- `src/runner/runMatch.ts`: protocol execution and match assembly.
- `src/scoring/aggregate.ts`: judge vote aggregation.
- `src/ledger/artifacts.ts`: match folder writer and transcript/scorecard renderers.
- `src/ledger/rebuild.ts`: ledger index rebuild.
- `src/ledger/replay.ts`: replay renderer.
- `src/ledger/leaderboard.ts`: simple ledger summary.
- `src/adapters/openaiAgentsSdk.ts`: optional OpenAI Agents SDK adapter boundary.
- `src/cli/main.ts`: CLI entrypoint.
- `examples/protocols/classic_v1.yaml`: sample protocol.
- `examples/conjectures/ai_tutors_homework_001.yaml`: sample conjecture.
- `examples/agents/stub_pro/agent_card.yaml`: deterministic pro stub card.
- `examples/agents/stub_con/agent_card.yaml`: deterministic con stub card.
- `examples/agents/openai_agents_sdk_example/agent_card.yaml`: optional real adapter card.
- `examples/judges/stub_panel/panel.yaml`: sample judge panel.
- `examples/judges/stub_panel/epistemic_stub_v1.yaml`: sample public judge card.
- `matches/index.json`: generated ledger index committed with at least one curated stub match.
- `tests/*.test.ts`: focused tests for schemas, runner, artifacts, ledger, CLI, and secret scanning.
- `.github/workflows/ci.yml`: deterministic CI.
- `README.md`: user-facing project overview and quickstart.
- `docs/architecture.md`: architecture and data flow.
- `docs/protocol.md`: protocol docs.
- `docs/agent_interface.md`: agent authoring docs.
- `docs/judge_interface.md`: judge authoring docs.
- `docs/publishing.md`: ledger and website publishing docs.
- `site/debate-club.md`: website-ready project page.
- `QUESTIONS.md`: non-blocking user questions.
- `ASSUMPTIONS.md`: reversible assumptions.
- `DECISIONS.md`: design and implementation decisions.

## Task 1: Bootstrap Package And Guardrails

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.npmignore`
- Create: `LICENSE`
- Create: `src/index.ts`
- Create: `tests/bootstrap.test.ts`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json` with this content:

```json
{
  "name": "debate-club",
  "version": "0.1.0",
  "description": "Open match protocol for private debate agents and public judge panels.",
  "type": "module",
  "bin": {
    "debateclub": "./dist/cli/main.js"
  },
  "files": [
    "dist",
    "examples",
    "docs",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "tsx src/cli/main.ts",
    "debate:stub": "tsx src/cli/main.ts run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/ai_tutors_homework_001.yaml --pro examples/agents/stub_pro --con examples/agents/stub_con --judges examples/judges/stub_panel --out matches",
    "ledger:rebuild": "tsx src/cli/main.ts ledger rebuild --matches matches",
    "replay:latest": "tsx src/cli/main.ts replay matches/latest"
  },
  "keywords": [
    "llm",
    "debate",
    "agents",
    "evaluation",
    "self-play"
  ],
  "author": "Shimon Bezalel",
  "license": "MIT",
  "dependencies": {
    "commander": "^12.1.0",
    "yaml": "^2.5.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "peerDependenciesMeta": {
    "@openai/agents": {
      "optional": true
    }
  }
}
```

- [ ] **Step 2: Create TypeScript and Vitest config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 3: Create ignore files and license**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
npm-debug.log*
.DS_Store
coverage/
matches/tmp/
private_agents/
```

Create `.npmignore`:

```gitignore
node_modules/
src/
tests/
coverage/
.github/
.env
.env.*
private_agents/
matches/tmp/
docs/superpowers/
```

Create `LICENSE` with the MIT license text and copyright line:

```text
MIT License

Copyright (c) 2026 Shimon Bezalel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Create minimal export and bootstrap test**

Create `src/index.ts`:

```ts
export const debateClubVersion = "0.1.0";
```

Create `tests/bootstrap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { debateClubVersion } from "../src/index.js";

describe("package bootstrap", () => {
  it("exports the milestone version", () => {
    expect(debateClubVersion).toBe("0.1.0");
  });
});
```

- [ ] **Step 5: Install dependencies and verify bootstrap**

Run:

```bash
npm install
npm test
npm run typecheck
```

Expected:

```text
Test Files  1 passed
```

`npm run typecheck` exits with code `0`.

- [ ] **Step 6: Record license decision**

Create `DECISIONS.md`:

```markdown
# Decisions

## 2026-06-27: Use MIT License For Milestone 0.1

The project starts under MIT because the approved design calls for a permissive open-source repository and no alternative license preference has been supplied. This can be changed before the first public release if needed.
```

- [ ] **Step 7: Commit bootstrap**

Run:

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore .npmignore LICENSE src/index.ts tests/bootstrap.test.ts DECISIONS.md
git commit -m "chore: bootstrap TypeScript package"
```

## Task 2: Define Domain Types And Schemas

**Files:**
- Create: `src/types/core.ts`
- Create: `src/schemas/conjecture.ts`
- Create: `src/schemas/protocol.ts`
- Create: `src/schemas/cards.ts`
- Create: `src/schemas/judgeVote.ts`
- Create: `src/schemas/load.ts`
- Modify: `src/index.ts`
- Create: `tests/schemas.test.ts`

- [ ] **Step 1: Write schema tests first**

Create `tests/schemas.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { conjectureSchema } from "../src/schemas/conjecture.js";
import { protocolSchema } from "../src/schemas/protocol.js";
import { agentCardSchema, judgeCardSchema, judgePanelSchema } from "../src/schemas/cards.js";
import { judgeVoteSchema } from "../src/schemas/judgeVote.js";
import { loadYamlFile } from "../src/schemas/load.js";

describe("schemas", () => {
  it("parses a structured conjecture", () => {
    const parsed = conjectureSchema.parse({
      id: "ai_tutors_homework_001",
      statement: "AI tutors should replace traditional homework for middle-school students.",
      domain: "education_policy",
      truth_type: "policy",
      stance_mode: "forced_random",
      evidence_mode: "no_external_info",
      allowed_tools: { web: false, calculator: false, evidence_pack: false },
      rubric_notes: ["distinguish replacement from supplementation"]
    });
    expect(parsed.truth_type).toBe("policy");
  });

  it("rejects an unsupported truth type", () => {
    expect(() =>
      conjectureSchema.parse({
        id: "bad",
        statement: "Bad",
        domain: "test",
        truth_type: "vibes",
        stance_mode: "forced_random",
        evidence_mode: "no_external_info",
        allowed_tools: { web: false, calculator: false, evidence_pack: false },
        rubric_notes: []
      })
    ).toThrow();
  });

  it("parses classic_v1 protocol turns", () => {
    const parsed = protocolSchema.parse({
      id: "classic_v1",
      prep_time_sec: 180,
      max_turn_tokens: 700,
      turns: [
        { id: "pro_opening", speaker: "pro", phase: "opening", time_sec: 120 },
        { id: "con_opening", speaker: "con", phase: "opening", time_sec: 120 }
      ]
    });
    expect(parsed.turns.map((turn) => turn.speaker)).toEqual(["pro", "con"]);
  });

  it("parses agent and judge cards plus panel", () => {
    expect(agentCardSchema.parse({
      name: "stub-pro-v1",
      version: "0.1.0",
      description: "Deterministic pro agent",
      adapter: "stub",
      private: false,
      supports: ["no_external_info"],
      input_modes: ["text"],
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    }).adapter).toBe("stub");

    expect(judgeCardSchema.parse({
      id: "epistemic-stub-v1",
      name: "Epistemic Stub",
      version: "0.1.0",
      adapter: "stub",
      public: true,
      rubric: {
        factual_accuracy: 0.25,
        responsiveness: 0.2,
        argument_structure: 0.2,
        burden_of_proof: 0.15,
        handling_counterarguments: 0.15,
        style_clarity: 0.05
      }
    }).public).toBe(true);

    expect(judgePanelSchema.parse({
      id: "stub_panel",
      judges: ["epistemic_stub_v1.yaml"]
    }).judges).toHaveLength(1);
  });

  it("parses structured judge votes", () => {
    const vote = judgeVoteSchema.parse({
      judge_id: "epistemic-stub-v1",
      winner: "pro",
      confidence: 0.72,
      scores: {
        pro: { factual_accuracy: 8, responsiveness: 7, argument_structure: 8, burden_of_proof: 7, handling_counterarguments: 9, style_clarity: 8 },
        con: { factual_accuracy: 7, responsiveness: 8, argument_structure: 7, burden_of_proof: 6, handling_counterarguments: 6, style_clarity: 8 }
      },
      decisive_moments: [{ turn_id: "pro_rebuttal", reason: "Pro answered the strongest objection." }],
      flags: [{ side: "con", type: "unsupported_empirical_claim", severity: "medium", quote: "It always works." }]
    });
    expect(vote.confidence).toBeGreaterThan(0.7);
  });

  it("loads YAML files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "debate-club-schema-"));
    const file = join(dir, "sample.yaml");
    await writeFile(file, "id: classic_v1\\nprep_time_sec: 180\\nmax_turn_tokens: 700\\nturns: []\\n");
    const loaded = await loadYamlFile(file);
    expect(loaded).toMatchObject({ id: "classic_v1" });
  });
});
```

- [ ] **Step 2: Run failing schema tests**

Run:

```bash
npm test -- tests/schemas.test.ts
```

Expected: fails because the schema modules do not exist.

- [ ] **Step 3: Implement core types**

Create `src/types/core.ts`:

```ts
export type Side = "pro" | "con";
export type DebateWinner = Side | "tie";
export type EvidenceMode = "no_external_info" | "provided_packet_only" | "web_allowed_with_citations" | "tools_allowed";
export type TruthType = "factual_known" | "factual_uncertain" | "normative" | "policy" | "philosophical" | "technical_design" | "strategic";
export type DebatePhase = "opening" | "rebuttal" | "cross_exam" | "answer" | "closing";

export interface TurnBudget {
  time_sec: number;
  max_tokens: number;
}

export interface DebateMove {
  turn_id: string;
  speaker: Side;
  phase: DebatePhase;
  text: string;
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
```

- [ ] **Step 4: Implement schemas and loader**

Create `src/schemas/conjecture.ts`:

```ts
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
  rubric_notes: z.array(z.string())
});
```

Create `src/schemas/protocol.ts`:

```ts
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
```

Create `src/schemas/cards.ts`:

```ts
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
  rubric: rubricWeightsSchema
});

export const judgePanelSchema = z.object({
  id: z.string().min(1),
  judges: z.array(z.string().min(1)).min(1)
});
```

Create `src/schemas/judgeVote.ts`:

```ts
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
  }))
});
```

Create `src/schemas/load.ts`:

```ts
import { readFile } from "node:fs/promises";
import YAML from "yaml";

export async function loadYamlFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return YAML.parse(raw);
}

export function explainZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues;
    return issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 5: Export schema modules**

Replace `src/index.ts` with:

```ts
export const debateClubVersion = "0.1.0";

export * from "./types/core.js";
export * from "./schemas/conjecture.js";
export * from "./schemas/protocol.js";
export * from "./schemas/cards.js";
export * from "./schemas/judgeVote.js";
export * from "./schemas/load.js";
```

- [ ] **Step 6: Verify schemas**

Run:

```bash
npm test -- tests/schemas.test.ts
npm run typecheck
```

Expected:

```text
Test Files  1 passed
```

`npm run typecheck` exits with code `0`.

- [ ] **Step 7: Commit schemas**

Run:

```bash
git add src/types src/schemas src/index.ts tests/schemas.test.ts
git commit -m "feat: add debate schemas"
```

## Task 3: Add Example Configurations

**Files:**
- Create: `examples/protocols/classic_v1.yaml`
- Create: `examples/conjectures/ai_tutors_homework_001.yaml`
- Create: `examples/agents/stub_pro/agent_card.yaml`
- Create: `examples/agents/stub_con/agent_card.yaml`
- Create: `examples/judges/stub_panel/panel.yaml`
- Create: `examples/judges/stub_panel/epistemic_stub_v1.yaml`
- Create: `tests/examples.test.ts`

- [ ] **Step 1: Write example fixture tests first**

Create `tests/examples.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { agentCardSchema, judgeCardSchema, judgePanelSchema } from "../src/schemas/cards.js";
import { conjectureSchema } from "../src/schemas/conjecture.js";
import { loadYamlFile } from "../src/schemas/load.js";
import { protocolSchema } from "../src/schemas/protocol.js";

describe("example configurations", () => {
  it("loads the classic protocol fixture", async () => {
    const protocol = protocolSchema.parse(await loadYamlFile("examples/protocols/classic_v1.yaml"));
    expect(protocol.turns.map((turn) => turn.id)).toEqual([
      "pro_opening",
      "con_opening",
      "pro_rebuttal",
      "con_rebuttal",
      "pro_closing",
      "con_closing"
    ]);
  });

  it("loads the AI tutors conjecture fixture", async () => {
    const conjecture = conjectureSchema.parse(await loadYamlFile("examples/conjectures/ai_tutors_homework_001.yaml"));
    expect(conjecture.evidence_mode).toBe("no_external_info");
  });

  it("loads stub agent cards", async () => {
    const pro = agentCardSchema.parse(await loadYamlFile("examples/agents/stub_pro/agent_card.yaml"));
    const con = agentCardSchema.parse(await loadYamlFile("examples/agents/stub_con/agent_card.yaml"));
    expect([pro.stance, con.stance]).toEqual(["pro", "con"]);
  });

  it("loads the stub judge panel", async () => {
    const panel = judgePanelSchema.parse(await loadYamlFile("examples/judges/stub_panel/panel.yaml"));
    const judge = judgeCardSchema.parse(await loadYamlFile("examples/judges/stub_panel/epistemic_stub_v1.yaml"));
    expect(panel.judges).toEqual(["epistemic_stub_v1.yaml"]);
    expect(judge.public).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing fixture tests**

Run:

```bash
npm test -- tests/examples.test.ts
```

Expected: fails because the example YAML files do not exist.

- [ ] **Step 3: Create protocol and conjecture fixtures**

Create `examples/protocols/classic_v1.yaml`:

```yaml
id: classic_v1
prep_time_sec: 180
max_turn_tokens: 700
turns:
  - id: pro_opening
    speaker: pro
    phase: opening
    time_sec: 120
  - id: con_opening
    speaker: con
    phase: opening
    time_sec: 120
  - id: pro_rebuttal
    speaker: pro
    phase: rebuttal
    time_sec: 90
  - id: con_rebuttal
    speaker: con
    phase: rebuttal
    time_sec: 90
  - id: pro_closing
    speaker: pro
    phase: closing
    time_sec: 90
  - id: con_closing
    speaker: con
    phase: closing
    time_sec: 90
```

Create `examples/conjectures/ai_tutors_homework_001.yaml`:

```yaml
id: ai_tutors_homework_001
statement: "AI tutors should replace traditional homework for middle-school students."
domain: education_policy
truth_type: policy
stance_mode: forced_random
evidence_mode: no_external_info
allowed_tools:
  web: false
  calculator: false
  evidence_pack: false
background:
  short_context: "Debate whether AI tutors should replace traditional homework, not whether AI tutors are useful in general."
rubric_notes:
  - distinguish replacement from supplementation
  - discuss equity, feedback quality, cheating, and motivation
  - avoid unsupported empirical claims
```

- [ ] **Step 4: Create agent and judge fixtures**

Create `examples/agents/stub_pro/agent_card.yaml`:

```yaml
name: stub-pro-v1
version: 0.1.0
description: Deterministic pro agent for local tests and examples.
adapter: stub
private: false
supports:
  - no_external_info
input_modes:
  - text
stance: pro
style: structured_policy_case
resource_limits:
  max_wall_time_sec: 180
  max_tokens_per_turn: 700
```

Create `examples/agents/stub_con/agent_card.yaml`:

```yaml
name: stub-con-v1
version: 0.1.0
description: Deterministic con agent for local tests and examples.
adapter: stub
private: false
supports:
  - no_external_info
input_modes:
  - text
stance: con
style: skeptical_policy_case
resource_limits:
  max_wall_time_sec: 180
  max_tokens_per_turn: 700
```

Create `examples/judges/stub_panel/panel.yaml`:

```yaml
id: stub_panel
judges:
  - epistemic_stub_v1.yaml
```

Create `examples/judges/stub_panel/epistemic_stub_v1.yaml`:

```yaml
id: epistemic-stub-v1
name: Epistemic Stub Judge
version: 0.1.0
adapter: stub
public: true
rubric:
  factual_accuracy: 0.25
  responsiveness: 0.20
  argument_structure: 0.20
  burden_of_proof: 0.15
  handling_counterarguments: 0.15
  style_clarity: 0.05
```

- [ ] **Step 5: Verify fixtures**

Run:

```bash
npm test -- tests/examples.test.ts
npm run typecheck
```

Expected:

```text
Test Files  1 passed
```

- [ ] **Step 6: Commit examples**

Run:

```bash
git add examples tests/examples.test.ts
git commit -m "test: add example debate configs"
```

## Task 4: Implement Stub Agents And Stub Judges

**Files:**
- Create: `src/agents/interface.ts`
- Create: `src/agents/stubAgent.ts`
- Create: `src/agents/loadAgent.ts`
- Create: `src/judges/interface.ts`
- Create: `src/judges/stubJudge.ts`
- Create: `src/judges/loadPanel.ts`
- Modify: `src/index.ts`
- Create: `tests/stubs.test.ts`

- [ ] **Step 1: Write stub behavior tests first**

Create `tests/stubs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createStubAgent } from "../src/agents/stubAgent.js";
import { loadAgentFromDirectory } from "../src/agents/loadAgent.js";
import { loadJudgePanel } from "../src/judges/loadPanel.js";

describe("stub agents and judges", () => {
  it("creates deterministic stub agent moves", async () => {
    const agent = createStubAgent({
      name: "stub-pro-v1",
      version: "0.1.0",
      description: "test",
      adapter: "stub",
      private: false,
      supports: ["no_external_info"],
      input_modes: ["text"],
      stance: "pro",
      style: "structured_policy_case",
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    });
    const move = await agent.speak({
      match_id: "match-test",
      conjecture: {
        id: "c1",
        statement: "AI tutors should replace homework.",
        domain: "education_policy",
        truth_type: "policy",
        stance_mode: "forced_random",
        evidence_mode: "no_external_info",
        allowed_tools: { web: false, calculator: false, evidence_pack: false },
        rubric_notes: []
      },
      protocol: { id: "classic_v1", prep_time_sec: 180, max_turn_tokens: 700, turns: [] },
      side: "pro",
      turn: { id: "pro_opening", speaker: "pro", phase: "opening", time_sec: 120 },
      transcript: []
    }, { time_sec: 120, max_tokens: 700 });
    expect(move.text).toContain("Pro opening");
    expect(move.speaker).toBe("pro");
  });

  it("loads stub agent cards from directories", async () => {
    const agent = await loadAgentFromDirectory("examples/agents/stub_pro");
    expect(agent.card.name).toBe("stub-pro-v1");
  });

  it("loads stub judge panels", async () => {
    const judges = await loadJudgePanel("examples/judges/stub_panel");
    expect(judges).toHaveLength(1);
    expect(judges[0].card.id).toBe("epistemic-stub-v1");
  });
});
```

- [ ] **Step 2: Run failing stub tests**

Run:

```bash
npm test -- tests/stubs.test.ts
```

Expected: fails because agent and judge modules do not exist.

- [ ] **Step 3: Implement agent interface and stub**

Create `src/agents/interface.ts`:

```ts
import type { AgentCard, DebateEvent, DebateMove, DebateObservation, MatchContext, TurnBudget } from "../types/core.js";

export interface DebateAgent {
  card: AgentCard;
  prepare(context: MatchContext): Promise<void>;
  speak(observation: DebateObservation, budget: TurnBudget): Promise<DebateMove>;
  observe(event: DebateEvent): Promise<void>;
}
```

Create `src/agents/stubAgent.ts`:

```ts
import type { AgentCard, DebateEvent, DebateMove, DebateObservation, MatchContext, TurnBudget } from "../types/core.js";
import type { DebateAgent } from "./interface.js";

function phaseLabel(phase: string): string {
  return phase.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function sideLabel(side: "pro" | "con"): string {
  return side === "pro" ? "Pro" : "Con";
}

export function createStubAgent(card: AgentCard): DebateAgent {
  const observedTurns: string[] = [];
  return {
    card,
    async prepare(_context: MatchContext): Promise<void> {
      observedTurns.length = 0;
    },
    async speak(observation: DebateObservation, _budget: TurnBudget): Promise<DebateMove> {
      const label = `${sideLabel(observation.side)} ${phaseLabel(observation.turn.phase)}`;
      const opponentClaims = observation.transcript.length === 0
        ? "No prior claims have been made."
        : `Prior claims: ${observation.transcript.map((turn) => turn.turn_id).join(", ")}.`;
      const stanceClaim = observation.side === "pro"
        ? "Replacement deserves a fair trial when it improves feedback speed, personalization, and accountability."
        : "Replacement is too strong because homework also builds practice habits, teacher context, and equitable routines.";
      return {
        turn_id: observation.turn.id,
        speaker: observation.side,
        phase: observation.turn.phase,
        text: `${label}: ${stanceClaim} ${opponentClaims} The burden is to compare replacement against supplementation, not against doing nothing.`
      };
    },
    async observe(event: DebateEvent): Promise<void> {
      observedTurns.push(event.turn.turn_id);
    }
  };
}
```

- [ ] **Step 4: Implement loaders and judge**

Create `src/agents/loadAgent.ts`:

```ts
import { join } from "node:path";
import { agentCardSchema } from "../schemas/cards.js";
import { loadYamlFile } from "../schemas/load.js";
import { createStubAgent } from "./stubAgent.js";
import type { DebateAgent } from "./interface.js";

export async function loadAgentFromDirectory(directory: string): Promise<DebateAgent> {
  const card = agentCardSchema.parse(await loadYamlFile(join(directory, "agent_card.yaml")));
  if (card.adapter === "stub") {
    return createStubAgent(card);
  }
  throw new Error(`Agent adapter '${card.adapter}' requires optional configuration and is not available through loadAgentFromDirectory.`);
}
```

Create `src/judges/interface.ts`:

```ts
import type { CompletedMatch, JudgeCard, JudgeVote } from "../types/core.js";

export interface DebateJudge {
  card: JudgeCard;
  judge(match: CompletedMatch): Promise<JudgeVote>;
}
```

Create `src/judges/stubJudge.ts`:

```ts
import type { CompletedMatch, JudgeCard, JudgeVote, Side } from "../types/core.js";
import type { DebateJudge } from "./interface.js";

function sideWord(side: Side): string {
  return side === "pro" ? "Pro" : "Con";
}

export function createStubJudge(card: JudgeCard): DebateJudge {
  return {
    card,
    async judge(match: CompletedMatch): Promise<JudgeVote> {
      const proWords = match.transcript.filter((turn) => turn.speaker === "pro").reduce((sum, turn) => sum + turn.text.split(/\\s+/).length, 0);
      const conWords = match.transcript.filter((turn) => turn.speaker === "con").reduce((sum, turn) => sum + turn.text.split(/\\s+/).length, 0);
      const winner: Side = proWords >= conWords ? "pro" : "con";
      return {
        judge_id: card.id,
        winner,
        confidence: 0.64,
        scores: {
          pro: { factual_accuracy: 7, responsiveness: 7, argument_structure: winner === "pro" ? 8 : 7, burden_of_proof: 7, handling_counterarguments: 7, style_clarity: 8 },
          con: { factual_accuracy: 7, responsiveness: 7, argument_structure: winner === "con" ? 8 : 7, burden_of_proof: 7, handling_counterarguments: 7, style_clarity: 8 }
        },
        decisive_moments: [{
          turn_id: match.transcript.find((turn) => turn.speaker === winner)?.turn_id ?? `${winner}_opening`,
          reason: `${sideWord(winner)} produced the stronger deterministic stub case under the public rubric.`
        }],
        flags: []
      };
    }
  };
}
```

Create `src/judges/loadPanel.ts`:

```ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeCardSchema, judgePanelSchema } from "../schemas/cards.js";
import { loadYamlFile } from "../schemas/load.js";
import { createStubJudge } from "./stubJudge.js";
import type { DebateJudge } from "./interface.js";

export async function loadJudgePanel(panelDirectory: string): Promise<DebateJudge[]> {
  const panel = judgePanelSchema.parse(await loadYamlFile(join(panelDirectory, "panel.yaml")));
  const judges: DebateJudge[] = [];
  for (const judgeFile of panel.judges) {
    const card = judgeCardSchema.parse(await loadYamlFile(join(panelDirectory, judgeFile)));
    if (card.adapter !== "stub") {
      throw new Error(`Judge adapter '${card.adapter}' requires optional configuration and is not available in the deterministic loader.`);
    }
    judges.push(createStubJudge(card));
  }
  return judges;
}

export function moduleDirectory(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}
```

- [ ] **Step 5: Export agent and judge modules**

Append these exports to `src/index.ts`:

```ts
export * from "./agents/interface.js";
export * from "./agents/stubAgent.js";
export * from "./agents/loadAgent.js";
export * from "./judges/interface.js";
export * from "./judges/stubJudge.js";
export * from "./judges/loadPanel.js";
```

- [ ] **Step 6: Verify stubs**

Run:

```bash
npm test -- tests/stubs.test.ts
npm run typecheck
```

Expected:

```text
Test Files  1 passed
```

- [ ] **Step 7: Commit stubs**

Run:

```bash
git add src/agents src/judges src/index.ts tests/stubs.test.ts
git commit -m "feat: add stub agents and judges"
```

## Task 5: Implement Runner And Scoring

**Files:**
- Create: `src/scoring/aggregate.ts`
- Create: `src/runner/runMatch.ts`
- Modify: `src/index.ts`
- Create: `tests/runner.test.ts`

- [ ] **Step 1: Write runner test first**

Create `tests/runner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadAgentFromDirectory } from "../src/agents/loadAgent.js";
import { loadJudgePanel } from "../src/judges/loadPanel.js";
import { runMatch } from "../src/runner/runMatch.js";
import { conjectureSchema } from "../src/schemas/conjecture.js";
import { loadYamlFile } from "../src/schemas/load.js";
import { protocolSchema } from "../src/schemas/protocol.js";

describe("runMatch", () => {
  it("runs a complete deterministic classic_v1 debate", async () => {
    const protocol = protocolSchema.parse(await loadYamlFile("examples/protocols/classic_v1.yaml"));
    const conjecture = conjectureSchema.parse(await loadYamlFile("examples/conjectures/ai_tutors_homework_001.yaml"));
    const pro = await loadAgentFromDirectory("examples/agents/stub_pro");
    const con = await loadAgentFromDirectory("examples/agents/stub_con");
    const judges = await loadJudgePanel("examples/judges/stub_panel");

    const match = await runMatch({ protocol, conjecture, agents: { pro, con }, judges, matchId: "match-test-001" });

    expect(match.match_id).toBe("match-test-001");
    expect(match.transcript).toHaveLength(6);
    expect(match.judge_votes).toHaveLength(1);
    expect(match.result.judge_split.pro + match.result.judge_split.con + match.result.judge_split.tie).toBe(1);
    expect(match.transcript[0].turn_id).toBe("pro_opening");
  });
});
```

- [ ] **Step 2: Run failing runner test**

Run:

```bash
npm test -- tests/runner.test.ts
```

Expected: fails because runner and scoring modules do not exist.

- [ ] **Step 3: Implement scoring aggregation**

Create `src/scoring/aggregate.ts`:

```ts
import type { DebateWinner, JudgeVote, ScoreSummary } from "../types/core.js";

function variance(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function aggregateVotes(votes: JudgeVote[]): ScoreSummary {
  const judge_split: Record<DebateWinner, number> = { pro: 0, con: 0, tie: 0 };
  for (const vote of votes) {
    judge_split[vote.winner] += 1;
  }
  const winner = (Object.entries(judge_split).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "tie") as DebateWinner;
  const confidences = votes.map((vote) => vote.confidence);
  const confidence_mean = confidences.length === 0 ? 0 : confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return {
    winner,
    judge_split,
    confidence_mean,
    confidence_variance: variance(confidences, confidence_mean),
    flags: votes.flatMap((vote) => vote.flags)
  };
}
```

- [ ] **Step 4: Implement match runner**

Create `src/runner/runMatch.ts`:

```ts
import type { DebateAgent } from "../agents/interface.js";
import type { DebateJudge } from "../judges/interface.js";
import { aggregateVotes } from "../scoring/aggregate.js";
import type { CompletedMatch, Conjecture, DebateProtocol, DebateTurn, Side } from "../types/core.js";

export interface RunMatchInput {
  protocol: DebateProtocol;
  conjecture: Conjecture;
  agents: Record<Side, DebateAgent>;
  judges: DebateJudge[];
  matchId: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\\s+/).filter(Boolean).length * 1.33);
}

export async function runMatch(input: RunMatchInput): Promise<CompletedMatch> {
  if (input.conjecture.evidence_mode !== "no_external_info") {
    throw new Error(`Milestone 0.1 can execute only no_external_info debates, received '${input.conjecture.evidence_mode}'.`);
  }

  await input.agents.pro.prepare({
    match_id: input.matchId,
    conjecture: input.conjecture,
    protocol: input.protocol,
    side: "pro",
    opponent: "con",
    evidence_mode: input.conjecture.evidence_mode
  });
  await input.agents.con.prepare({
    match_id: input.matchId,
    conjecture: input.conjecture,
    protocol: input.protocol,
    side: "con",
    opponent: "pro",
    evidence_mode: input.conjecture.evidence_mode
  });

  const transcript: DebateTurn[] = [];
  for (const turn of input.protocol.turns) {
    const agent = input.agents[turn.speaker];
    const started = Date.now();
    const move = await agent.speak({
      match_id: input.matchId,
      conjecture: input.conjecture,
      protocol: input.protocol,
      side: turn.speaker,
      turn,
      transcript: [...transcript]
    }, { time_sec: turn.time_sec, max_tokens: input.protocol.max_turn_tokens });
    const completed = Date.now();
    const debateTurn: DebateTurn = {
      ...move,
      turn_id: turn.id,
      speaker: turn.speaker,
      phase: turn.phase,
      started_at: new Date(started).toISOString(),
      completed_at: new Date(completed).toISOString(),
      time_used_sec: Math.max(0, (completed - started) / 1000),
      tokens_estimate: estimateTokens(move.text)
    };
    transcript.push(debateTurn);
    await input.agents.pro.observe({ type: "turn_completed", turn: debateTurn });
    await input.agents.con.observe({ type: "turn_completed", turn: debateTurn });
  }

  const baseMatch: CompletedMatch = {
    match_id: input.matchId,
    created_at: nowIso(),
    conjecture: input.conjecture,
    protocol: input.protocol,
    agents: {
      pro: input.agents.pro.card,
      con: input.agents.con.card
    },
    transcript,
    judge_votes: [],
    result: { winner: "tie", judge_split: { pro: 0, con: 0, tie: 0 }, confidence_mean: 0, confidence_variance: 0, flags: [] }
  };

  const judge_votes = [];
  for (const judge of input.judges) {
    judge_votes.push(await judge.judge(baseMatch));
  }
  const result = aggregateVotes(judge_votes);
  return { ...baseMatch, judge_votes, result };
}
```

- [ ] **Step 5: Export runner and scoring**

Append these exports to `src/index.ts`:

```ts
export * from "./runner/runMatch.js";
export * from "./scoring/aggregate.js";
```

- [ ] **Step 6: Verify runner**

Run:

```bash
npm test -- tests/runner.test.ts
npm run typecheck
```

Expected:

```text
Test Files  1 passed
```

- [ ] **Step 7: Commit runner**

Run:

```bash
git add src/runner src/scoring src/index.ts tests/runner.test.ts
git commit -m "feat: run deterministic debate matches"
```

## Task 6: Write Match Artifacts And Ledger Index

**Files:**
- Create: `src/ledger/artifacts.ts`
- Create: `src/ledger/rebuild.ts`
- Create: `src/ledger/replay.ts`
- Create: `src/ledger/leaderboard.ts`
- Modify: `src/index.ts`
- Create: `tests/ledger.test.ts`

- [ ] **Step 1: Write ledger tests first**

Create `tests/ledger.test.ts`:

```ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAgentFromDirectory } from "../src/agents/loadAgent.js";
import { writeMatchArtifacts } from "../src/ledger/artifacts.js";
import { buildLeaderboard } from "../src/ledger/leaderboard.js";
import { rebuildLedgerIndex } from "../src/ledger/rebuild.js";
import { replayMatch } from "../src/ledger/replay.js";
import { loadJudgePanel } from "../src/judges/loadPanel.js";
import { runMatch } from "../src/runner/runMatch.js";
import { conjectureSchema } from "../src/schemas/conjecture.js";
import { loadYamlFile } from "../src/schemas/load.js";
import { protocolSchema } from "../src/schemas/protocol.js";

async function createMatch() {
  const protocol = protocolSchema.parse(await loadYamlFile("examples/protocols/classic_v1.yaml"));
  const conjecture = conjectureSchema.parse(await loadYamlFile("examples/conjectures/ai_tutors_homework_001.yaml"));
  return runMatch({
    protocol,
    conjecture,
    agents: { pro: await loadAgentFromDirectory("examples/agents/stub_pro"), con: await loadAgentFromDirectory("examples/agents/stub_con") },
    judges: await loadJudgePanel("examples/judges/stub_panel"),
    matchId: "match-ledger-001"
  });
}

describe("ledger artifacts", () => {
  it("writes match artifacts and rebuilds the index", async () => {
    const out = await mkdtemp(join(tmpdir(), "debate-club-ledger-"));
    const match = await createMatch();
    const folder = await writeMatchArtifacts(match, out);
    const transcript = await readFile(join(folder, "transcript.md"), "utf8");
    const scorecard = await readFile(join(folder, "scorecard.md"), "utf8");
    expect(transcript).toContain("# Debate Transcript");
    expect(scorecard).toContain("Winner");

    const index = await rebuildLedgerIndex(out);
    expect(index.matches).toHaveLength(1);
    expect(index.matches[0].match_id).toBe("match-ledger-001");

    const replay = await replayMatch(folder);
    expect(replay).toContain("pro_opening");

    const leaderboard = await buildLeaderboard(out);
    expect(leaderboard).toContain("stub-pro-v1");
  });
});
```

- [ ] **Step 2: Run failing ledger tests**

Run:

```bash
npm test -- tests/ledger.test.ts
```

Expected: fails because ledger modules do not exist.

- [ ] **Step 3: Implement artifact writer**

Create `src/ledger/artifacts.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompletedMatch, DebateTurn } from "../types/core.js";

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\\n`;
}

export function renderTranscriptMarkdown(match: CompletedMatch): string {
  const lines = [
    "# Debate Transcript",
    "",
    `Match: ${match.match_id}`,
    `Conjecture: ${match.conjecture.statement}`,
    `Protocol: ${match.protocol.id}`,
    "",
    ...match.transcript.flatMap((turn) => [
      `## ${turn.turn_id}`,
      "",
      `Speaker: ${turn.speaker}`,
      `Phase: ${turn.phase}`,
      `Time used: ${turn.time_used_sec.toFixed(3)}s`,
      `Token estimate: ${turn.tokens_estimate}`,
      "",
      turn.text,
      ""
    ])
  ];
  return `${lines.join("\\n").trim()}\\n`;
}

export function renderTranscriptJsonl(turns: DebateTurn[]): string {
  return turns.map((turn) => JSON.stringify(turn)).join("\\n") + "\\n";
}

export function renderScorecard(match: CompletedMatch): string {
  return [
    "# Debate Scorecard",
    "",
    `Match: ${match.match_id}`,
    `Winner: ${match.result.winner}`,
    `Judge split: pro ${match.result.judge_split.pro}, con ${match.result.judge_split.con}, tie ${match.result.judge_split.tie}`,
    `Mean confidence: ${match.result.confidence_mean.toFixed(2)}`,
    "",
    "## Judge Votes",
    "",
    ...match.judge_votes.flatMap((vote) => [
      `### ${vote.judge_id}`,
      "",
      `Winner: ${vote.winner}`,
      `Confidence: ${vote.confidence.toFixed(2)}`,
      `Decisive moments: ${vote.decisive_moments.map((moment) => `${moment.turn_id}: ${moment.reason}`).join("; ") || "None"}`,
      `Flags: ${vote.flags.length}`,
      ""
    ])
  ].join("\\n");
}

export async function writeMatchArtifacts(match: CompletedMatch, outputRoot: string): Promise<string> {
  const folder = join(outputRoot, match.match_id);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "match.json"), json(match));
  await writeFile(join(folder, "transcript.md"), renderTranscriptMarkdown(match));
  await writeFile(join(folder, "transcript.jsonl"), renderTranscriptJsonl(match.transcript));
  await writeFile(join(folder, "judge_votes.json"), json(match.judge_votes));
  await writeFile(join(folder, "scorecard.md"), renderScorecard(match));
  await writeFile(join(folder, "timing.json"), json({ turns: match.transcript.map((turn) => ({ turn_id: turn.turn_id, time_used_sec: turn.time_used_sec, tokens_estimate: turn.tokens_estimate })) }));
  await writeFile(join(folder, "tool_log.json"), json({ tools_used: [], evidence_mode: match.conjecture.evidence_mode }));
  return folder;
}
```

- [ ] **Step 4: Implement ledger rebuild, replay, and leaderboard**

Create `src/ledger/rebuild.ts`:

```ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompletedMatch } from "../types/core.js";

export interface LedgerIndex {
  generated_at: string;
  matches: Array<{
    match_id: string;
    created_at: string;
    conjecture_id: string;
    conjecture_statement: string;
    protocol_id: string;
    pro_agent: string;
    con_agent: string;
    winner: string;
    judge_split: Record<string, number>;
    confidence_mean: number;
    paths: {
      match: string;
      transcript: string;
      scorecard: string;
    };
  }>;
}

export async function rebuildLedgerIndex(matchesRoot: string): Promise<LedgerIndex> {
  const entries = await readdir(matchesRoot, { withFileTypes: true }).catch(() => []);
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const matchPath = join(matchesRoot, entry.name, "match.json");
    const raw = await readFile(matchPath, "utf8").catch(() => undefined);
    if (!raw) {
      continue;
    }
    const match = JSON.parse(raw) as CompletedMatch;
    matches.push({
      match_id: match.match_id,
      created_at: match.created_at,
      conjecture_id: match.conjecture.id,
      conjecture_statement: match.conjecture.statement,
      protocol_id: match.protocol.id,
      pro_agent: match.agents.pro.name,
      con_agent: match.agents.con.name,
      winner: match.result.winner,
      judge_split: match.result.judge_split,
      confidence_mean: match.result.confidence_mean,
      paths: {
        match: `${entry.name}/match.json`,
        transcript: `${entry.name}/transcript.md`,
        scorecard: `${entry.name}/scorecard.md`
      }
    });
  }
  matches.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const index = { generated_at: new Date().toISOString(), matches };
  await writeFile(join(matchesRoot, "index.json"), `${JSON.stringify(index, null, 2)}\\n`);
  return index;
}
```

Create `src/ledger/replay.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function replayMatch(matchDirectory: string): Promise<string> {
  return readFile(join(matchDirectory, "transcript.md"), "utf8");
}
```

Create `src/ledger/leaderboard.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LedgerIndex } from "./rebuild.js";

export async function buildLeaderboard(matchesRoot: string): Promise<string> {
  const index = JSON.parse(await readFile(join(matchesRoot, "index.json"), "utf8")) as LedgerIndex;
  const rows = new Map<string, { wins: number; matches: number }>();
  for (const match of index.matches) {
    for (const agent of [match.pro_agent, match.con_agent]) {
      rows.set(agent, rows.get(agent) ?? { wins: 0, matches: 0 });
      rows.get(agent)!.matches += 1;
    }
    if (match.winner === "pro") {
      rows.get(match.pro_agent)!.wins += 1;
    }
    if (match.winner === "con") {
      rows.get(match.con_agent)!.wins += 1;
    }
  }
  const lines = ["Agent | Wins | Matches", "--- | ---: | ---:"];
  for (const [agent, score] of [...rows.entries()].sort((a, b) => b[1].wins - a[1].wins || a[0].localeCompare(b[0]))) {
    lines.push(`${agent} | ${score.wins} | ${score.matches}`);
  }
  return `${lines.join("\\n")}\\n`;
}
```

- [ ] **Step 5: Export ledger modules**

Append these exports to `src/index.ts`:

```ts
export * from "./ledger/artifacts.js";
export * from "./ledger/rebuild.js";
export * from "./ledger/replay.js";
export * from "./ledger/leaderboard.js";
```

- [ ] **Step 6: Verify ledger**

Run:

```bash
npm test -- tests/ledger.test.ts
npm run typecheck
```

Expected:

```text
Test Files  1 passed
```

- [ ] **Step 7: Commit ledger**

Run:

```bash
git add src/ledger src/index.ts tests/ledger.test.ts
git commit -m "feat: write debate ledger artifacts"
```

## Task 7: Build CLI Commands

**Files:**
- Create: `src/cli/main.ts`
- Modify: `package.json`
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Write CLI tests first**

Create `tests/cli.test.ts`:

```ts
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function runCli(args: string[]) {
  return execFileAsync("npx", ["tsx", "src/cli/main.ts", ...args], { cwd: process.cwd() });
}

describe("cli", () => {
  it("runs, rebuilds, replays, and summarizes a stub debate", async () => {
    const out = await mkdtemp(join(tmpdir(), "debate-club-cli-"));
    const run = await runCli([
      "run",
      "--protocol", "examples/protocols/classic_v1.yaml",
      "--conjecture", "examples/conjectures/ai_tutors_homework_001.yaml",
      "--pro", "examples/agents/stub_pro",
      "--con", "examples/agents/stub_con",
      "--judges", "examples/judges/stub_panel",
      "--out", out,
      "--match-id", "cli-match-001"
    ]);
    expect(run.stdout).toContain("cli-match-001");

    const index = JSON.parse(await readFile(join(out, "index.json"), "utf8"));
    expect(index.matches).toHaveLength(1);

    const replay = await runCli(["replay", join(out, "cli-match-001")]);
    expect(replay.stdout).toContain("Debate Transcript");

    const rebuild = await runCli(["ledger", "rebuild", "--matches", out]);
    expect(rebuild.stdout).toContain("1 match");

    const leaderboard = await runCli(["leaderboard", out]);
    expect(leaderboard.stdout).toContain("Agent | Wins | Matches");
  });
});
```

- [ ] **Step 2: Run failing CLI tests**

Run:

```bash
npm test -- tests/cli.test.ts
```

Expected: fails because `src/cli/main.ts` does not exist.

- [ ] **Step 3: Implement CLI entrypoint**

Create `src/cli/main.ts`:

```ts
#!/usr/bin/env node
import { existsSync } from "node:fs";
import { symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { loadAgentFromDirectory } from "../agents/loadAgent.js";
import { buildLeaderboard } from "../ledger/leaderboard.js";
import { rebuildLedgerIndex } from "../ledger/rebuild.js";
import { replayMatch } from "../ledger/replay.js";
import { writeMatchArtifacts } from "../ledger/artifacts.js";
import { loadJudgePanel } from "../judges/loadPanel.js";
import { runMatch } from "../runner/runMatch.js";
import { conjectureSchema } from "../schemas/conjecture.js";
import { explainZodError, loadYamlFile } from "../schemas/load.js";
import { protocolSchema } from "../schemas/protocol.js";

function defaultMatchId(conjectureId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${conjectureId}`;
}

async function updateLatestLink(matchesRoot: string, matchId: string): Promise<void> {
  const latest = join(matchesRoot, "latest");
  if (existsSync(latest)) {
    await unlink(latest);
  }
  await symlink(matchId, latest);
}

async function main(): Promise<void> {
  const program = new Command();
  program.name("debateclub").description("Run Debate Club matches and manage the open debate ledger.").version("0.1.0");

  program.command("run")
    .requiredOption("--protocol <path>")
    .requiredOption("--conjecture <path>")
    .requiredOption("--pro <directory>")
    .requiredOption("--con <directory>")
    .requiredOption("--judges <directory>")
    .requiredOption("--out <directory>")
    .option("--match-id <id>")
    .action(async (options) => {
      try {
        const protocol = protocolSchema.parse(await loadYamlFile(options.protocol));
        const conjecture = conjectureSchema.parse(await loadYamlFile(options.conjecture));
        const matchId = options.matchId ?? defaultMatchId(conjecture.id);
        const match = await runMatch({
          protocol,
          conjecture,
          agents: { pro: await loadAgentFromDirectory(options.pro), con: await loadAgentFromDirectory(options.con) },
          judges: await loadJudgePanel(options.judges),
          matchId
        });
        const folder = await writeMatchArtifacts(match, options.out);
        const index = await rebuildLedgerIndex(options.out);
        await updateLatestLink(options.out, match.match_id).catch(() => undefined);
        process.stdout.write(`Wrote match ${match.match_id}\\nFolder: ${folder}\\nLedger matches: ${index.matches.length}\\nWinner: ${match.result.winner}\\n`);
      } catch (error) {
        process.stderr.write(`debateclub run failed: ${explainZodError(error)}\\n`);
        process.exitCode = 1;
      }
    });

  program.command("replay")
    .argument("<match-directory>")
    .action(async (matchDirectory) => {
      try {
        process.stdout.write(await replayMatch(matchDirectory));
      } catch (error) {
        process.stderr.write(`debateclub replay failed: ${error instanceof Error ? error.message : String(error)}\\n`);
        process.exitCode = 1;
      }
    });

  const ledger = program.command("ledger");
  ledger.command("rebuild")
    .requiredOption("--matches <directory>")
    .action(async (options) => {
      try {
        const index = await rebuildLedgerIndex(options.matches);
        process.stdout.write(`Rebuilt ledger with ${index.matches.length} match${index.matches.length === 1 ? "" : "es"}\\n`);
      } catch (error) {
        process.stderr.write(`debateclub ledger rebuild failed: ${error instanceof Error ? error.message : String(error)}\\n`);
        process.exitCode = 1;
      }
    });

  program.command("leaderboard")
    .argument("<matches-directory>")
    .action(async (matchesDirectory) => {
      try {
        process.stdout.write(await buildLeaderboard(matchesDirectory));
      } catch (error) {
        process.stderr.write(`debateclub leaderboard failed: ${error instanceof Error ? error.message : String(error)}\\n`);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Ensure build emits executable CLI**

After TypeScript build, the shebang should remain in `dist/cli/main.js`. If it does not, keep `tsx src/cli/main.ts` as the documented local path for 0.1 and record the packaging limitation in `DECISIONS.md`.

Run:

```bash
npm run build
head -1 dist/cli/main.js
```

Expected first line:

```text
#!/usr/bin/env node
```

- [ ] **Step 5: Verify CLI commands**

Run:

```bash
npm test -- tests/cli.test.ts
npm run typecheck
npm run build
```

Expected:

```text
Test Files  1 passed
```

`typecheck` and `build` exit with code `0`.

- [ ] **Step 6: Commit CLI**

Run:

```bash
git add src/cli package.json tests/cli.test.ts
git commit -m "feat: add debateclub CLI"
```

## Task 8: Generate A Curated Stub Match

**Files:**
- Create: `matches/<generated-match-id>/*`
- Create/Modify: `matches/index.json`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Run a deterministic match into the repo ledger**

Run:

```bash
npm run cli -- run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/ai_tutors_homework_001.yaml --pro examples/agents/stub_pro --con examples/agents/stub_con --judges examples/judges/stub_panel --out matches --match-id 2026-06-27-ai-tutors-stub
```

Expected output contains:

```text
Wrote match 2026-06-27-ai-tutors-stub
Winner:
```

- [ ] **Step 2: Inspect generated artifacts**

Run:

```bash
ls matches/2026-06-27-ai-tutors-stub
sed -n '1,80p' matches/2026-06-27-ai-tutors-stub/transcript.md
sed -n '1,80p' matches/2026-06-27-ai-tutors-stub/scorecard.md
cat matches/index.json
```

Expected files:

```text
judge_votes.json
match.json
scorecard.md
timing.json
tool_log.json
transcript.jsonl
transcript.md
```

- [ ] **Step 3: Rebuild ledger and replay the match**

Run:

```bash
npm run cli -- ledger rebuild --matches matches
npm run cli -- replay matches/2026-06-27-ai-tutors-stub
npm run cli -- leaderboard matches
```

Expected:

```text
Rebuilt ledger with 1 match
```

Replay output contains `# Debate Transcript`; leaderboard output contains `stub-pro-v1`.

- [ ] **Step 4: Record curated-stub-match decision**

Append to `DECISIONS.md`:

```markdown

## 2026-06-27: Commit One Curated Stub Match

Milestone 0.1 commits one deterministic stub match so new users can inspect the ledger shape without spending API tokens. Real model match artifacts should be curated before commit because transcripts can contain private prompts, sensitive source material, or provider metadata.
```

- [ ] **Step 5: Commit generated match**

Run:

```bash
git add matches DECISIONS.md
git commit -m "data: add first stub debate ledger entry"
```

## Task 9: Add Optional OpenAI Agents SDK Adapter Boundary

**Files:**
- Create: `src/adapters/openaiAgentsSdk.ts`
- Create: `examples/agents/openai_agents_sdk_example/agent_card.yaml`
- Create: `examples/agents/openai_agents_sdk_example/README.md`
- Modify: `DECISIONS.md`
- Modify: `src/index.ts`
- Create: `tests/openaiAdapter.test.ts`

- [ ] **Step 1: Write adapter dry-run tests first**

Create `tests/openaiAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createOpenAiAgentsSdkAgent, openAiAgentsSdkAvailable } from "../src/adapters/openaiAgentsSdk.js";

describe("openai agents sdk adapter boundary", () => {
  it("reports availability without requiring credentials", async () => {
    const available = await openAiAgentsSdkAvailable();
    expect(typeof available).toBe("boolean");
  });

  it("fails clearly when asked to create an agent without OPENAI_API_KEY", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(createOpenAiAgentsSdkAgent({
      name: "openai-example-v1",
      version: "0.1.0",
      description: "example",
      adapter: "openai-agents-sdk",
      private: true,
      supports: ["no_external_info"],
      input_modes: ["text"],
      resource_limits: { max_wall_time_sec: 180, max_tokens_per_turn: 700 }
    })).rejects.toThrow(/OPENAI_API_KEY/);
    if (previous) {
      process.env.OPENAI_API_KEY = previous;
    }
  });
});
```

- [ ] **Step 2: Run failing adapter tests**

Run:

```bash
npm test -- tests/openaiAdapter.test.ts
```

Expected: fails because the adapter file does not exist.

- [ ] **Step 3: Implement optional adapter boundary**

Create `src/adapters/openaiAgentsSdk.ts`:

```ts
import type { AgentCard, DebateEvent, DebateMove, DebateObservation, MatchContext, TurnBudget } from "../types/core.js";
import type { DebateAgent } from "../agents/interface.js";

export async function openAiAgentsSdkAvailable(): Promise<boolean> {
  try {
    await import("@openai/agents");
    return true;
  } catch {
    return false;
  }
}

export async function createOpenAiAgentsSdkAgent(card: AgentCard): Promise<DebateAgent> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the openai-agents-sdk adapter.");
  }
  const available = await openAiAgentsSdkAvailable();
  if (!available) {
    throw new Error("Install optional package @openai/agents to use the openai-agents-sdk adapter.");
  }

  return {
    card,
    async prepare(_context: MatchContext): Promise<void> {
      return undefined;
    },
    async speak(observation: DebateObservation, _budget: TurnBudget): Promise<DebateMove> {
      throw new Error(`The openai-agents-sdk adapter boundary loaded for ${observation.match_id}, but live SDK speech is disabled until model prompts and spend controls are explicitly configured.`);
    },
    async observe(_event: DebateEvent): Promise<void> {
      return undefined;
    }
  };
}
```

Append to `src/index.ts`:

```ts
export * from "./adapters/openaiAgentsSdk.js";
```

- [ ] **Step 4: Add adapter example card and docs**

Create `examples/agents/openai_agents_sdk_example/agent_card.yaml`:

```yaml
name: openai-agents-sdk-example-v1
version: 0.1.0
description: Example private harness card for the optional OpenAI Agents SDK adapter.
adapter: openai-agents-sdk
private: true
supports:
  - no_external_info
input_modes:
  - text
resource_limits:
  max_wall_time_sec: 180
  max_tokens_per_turn: 700
```

Create `examples/agents/openai_agents_sdk_example/README.md`:

```markdown
# OpenAI Agents SDK Example

This directory demonstrates the public card shape for a private Debate Club harness that would use the optional OpenAI Agents SDK adapter.

The deterministic runner does not load this adapter in CI. To experiment locally, install the optional SDK package and set `OPENAI_API_KEY` in your shell. Do not commit `.env` files, private prompts, or model transcripts that contain secrets.

The 0.1 adapter intentionally stops before live speech generation unless spend controls and prompts are configured by the operator.
```

- [ ] **Step 5: Record adapter decision**

Append to `DECISIONS.md`:

```markdown

## 2026-06-27: Keep Real SDK Adapter Optional

The OpenAI Agents SDK adapter is represented as an optional boundary in 0.1. The deterministic project proof uses stubs, while real SDK execution requires explicit credentials, optional package installation, prompts, and spend controls. This keeps CI free and prevents accidental API calls.
```

- [ ] **Step 6: Verify adapter boundary**

Run:

```bash
npm test -- tests/openaiAdapter.test.ts
npm run typecheck
```

Expected:

```text
Test Files  1 passed
```

- [ ] **Step 7: Commit adapter boundary**

Run:

```bash
git add src/adapters src/index.ts examples/agents/openai_agents_sdk_example tests/openaiAdapter.test.ts DECISIONS.md
git commit -m "feat: add optional OpenAI Agents SDK boundary"
```

## Task 10: Documentation, Side Logs, And Site Artifact

**Files:**
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/protocol.md`
- Create: `docs/agent_interface.md`
- Create: `docs/judge_interface.md`
- Create: `docs/publishing.md`
- Create: `site/debate-club.md`
- Create: `QUESTIONS.md`
- Create: `ASSUMPTIONS.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```markdown
# Debate Club

Debate Club is an open match protocol and local runner for private debate agents and public judge panels.

A debate agent is a harness: prompts, skills, model configuration, memory strategy, tools, and debate strategy. Debate Club runs agents over structured conjectures under protocol constraints, asks public judge agents to score the result, and writes every match as an open artifact in a Git-backed ledger.

Debate win rate is not truth. The project tracks persuasion under constraints while preserving judge split, confidence, factuality flags, and transcript data for later analysis.

## Quickstart

```bash
npm install
npm run cli -- run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/ai_tutors_homework_001.yaml --pro examples/agents/stub_pro --con examples/agents/stub_con --judges examples/judges/stub_panel --out matches --match-id local-ai-tutors-stub
npm run cli -- replay matches/local-ai-tutors-stub
npm run cli -- ledger rebuild --matches matches
npm run cli -- leaderboard matches
```

The stub run writes:

- `match.json`
- `transcript.md`
- `transcript.jsonl`
- `judge_votes.json`
- `scorecard.md`
- `timing.json`
- `tool_log.json`
- `matches/index.json`

## Concepts

- Private debater harnesses: the runner calls a narrow `prepare`, `speak`, and `observe` interface.
- Public judges: judge cards and rubrics are visible and inspectable.
- Structured conjectures: topics include domain, truth type, evidence mode, allowed tools, and rubric notes.
- Protocol constraints: `classic_v1` records time and token budgets for each turn.
- Open match ledger: completed debates are committed as reviewable files.

## Optional SDK Adapter

The deterministic path uses stubs and requires no API key. The OpenAI Agents SDK adapter boundary is optional and refuses to run without `OPENAI_API_KEY` and the optional SDK package. Real model runs should be curated before committing transcripts.

## Roadmap

- 0.1 local deterministic debate runner
- 0.2 real SDK agents and judges
- 0.3 evidence-pack debates
- 0.4 cross-examination protocol
- 0.5 web debate mode with citations
- 0.6 league ratings with Elo, then Glicko or TrueSkill
- 0.7 public hosted debate archive
- 0.8 private-agent submission protocol
```

- [ ] **Step 2: Create docs**

Create `docs/architecture.md`, `docs/protocol.md`, `docs/agent_interface.md`, `docs/judge_interface.md`, and `docs/publishing.md` with concise sections matching the approved spec. Include exact quickstart commands from the README in `docs/publishing.md` and the TypeScript interfaces from the design spec in `docs/agent_interface.md` and `docs/judge_interface.md`.

- [ ] **Step 3: Create side logs**

Create `ASSUMPTIONS.md`:

```markdown
# Assumptions

- Milestone 0.1 uses TypeScript and Node.js.
- The default license is MIT.
- The deterministic proof path must run without network access or API keys.
- The first website artifact can live in this repository if the active personal site target is not confirmed.
```

Create `QUESTIONS.md`:

```markdown
# Questions

- Should the public project page be added to `/Users/shimon/ws/shimmybezalel`, the older `shimonbezalel.github.io` repository, or only kept in this repo for now?
- Should committed real-model match artifacts be curated manually before entering `matches/`?
- Should competitive agent cards allow fully hidden model declarations, or require declared model family?
```

- [ ] **Step 4: Create website-ready page**

Create `site/debate-club.md`:

```markdown
# Debate Club

Open match protocol for private debate agents and public judge panels.

## What It Is

Debate Club is a local runner and open ledger for competitive LLM debate agents. Agents argue structured conjectures under time, token, and tool constraints. Public judge agents score the transcript with transparent rubrics.

## Why Debate Agents

Most LLM evaluations inspect solo answers. Debate creates adversarial pressure: claims can be challenged, weak assumptions can be exposed, and rebuttal quality becomes observable.

## How A Match Works

1. Load a conjecture and debate protocol.
2. Assign private agent harnesses to pro and con.
3. Run turns under `classic_v1`.
4. Ask public judges for structured votes.
5. Write the transcript, scorecard, timing, and index to the open ledger.

## Open Debate Ledger

Each match is stored as files in `matches/`, including `transcript.md`, `transcript.jsonl`, `judge_votes.json`, `scorecard.md`, and `match.json`.

## Current Milestone

Milestone 0.1 proves the local deterministic path with stub agents and a stub public judge. Optional real SDK integration is isolated behind explicit credentials and spend controls.

## Links

- GitHub: `https://github.com/ShimonBezalel/debate-club`
- Example transcript: `matches/2026-06-27-ai-tutors-stub/transcript.md`
```

- [ ] **Step 5: Commit docs**

Run:

```bash
git add README.md docs site QUESTIONS.md ASSUMPTIONS.md
git commit -m "docs: explain Debate Club milestone"
```

## Task 11: Add CI And Secret Scan Test

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `tests/secrets.test.ts`

- [ ] **Step 1: Write secret scan test**

Create `tests/secrets.test.ts`:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("repository secret hygiene", () => {
  it("does not contain committed env files or obvious API key assignments", async () => {
    const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: process.cwd() });
    const tracked = stdout.split("\\n").filter(Boolean);
    expect(tracked.some((file) => file === ".env" || file.startsWith(".env."))).toBe(false);

    const grep = await execFileAsync("git", ["grep", "-nE", "(OPENAI_API_KEY|ANTHROPIC_API_KEY)\\s*="], { cwd: process.cwd() }).catch((error: unknown) => {
      const err = error as { code?: number; stdout?: string };
      if (err.code === 1) {
        return { stdout: "" };
      }
      throw error;
    });
    expect(grep.stdout.trim()).toBe("");
  });
});
```

- [ ] **Step 2: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Verify full deterministic suite**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected:

```text
Test Files  8 passed
```

The exact count may differ if tests are split further; every test file must pass.

- [ ] **Step 4: Commit CI**

Run:

```bash
git add .github tests/secrets.test.ts
git commit -m "ci: add deterministic test workflow"
```

## Task 12: Website Repo Check And Optional Preview Change

**Files:**
- Inspect: `/Users/shimon/ws/shimmybezalel/package.json`
- Inspect: `/Users/shimon/ws/shimmybezalel/src/pages`
- Optional create: `/Users/shimon/ws/shimmybezalel/src/pages/projects/debate-club.astro`
- Optional modify: `/Users/shimon/ws/shimmybezalel/src/pages/index.astro`
- Modify: `QUESTIONS.md` or `DECISIONS.md`

- [ ] **Step 1: Inspect website repo without editing**

Run:

```bash
git -C /Users/shimon/ws/shimmybezalel status --short --branch
cat /Users/shimon/ws/shimmybezalel/package.json
find /Users/shimon/ws/shimmybezalel/src/pages -maxdepth 2 -type f -print
```

Expected: identify Astro scripts and page conventions. If the worktree is dirty with unrelated changes, do not modify those files until you understand whether changes are related.

- [ ] **Step 2: Run site checks before deciding**

Run:

```bash
npm --prefix /Users/shimon/ws/shimmybezalel install
npm --prefix /Users/shimon/ws/shimmybezalel run build
```

Expected: build exits with code `0`. If install or build fails for existing-site reasons, record the failure in `QUESTIONS.md` and keep `site/debate-club.md` as the publishable artifact for 0.1.

- [ ] **Step 3: If the Astro site is clean and buildable, add a static preview page**

Create `/Users/shimon/ws/shimmybezalel/src/pages/projects/debate-club.astro` with Astro frontmatter using the existing site layout imports. Use restrained copy from `site/debate-club.md`. Do not add production deployment commands.

If the existing site has no `projects` route, create only the page and do not modify navigation unless the home page has a clear projects list pattern.

- [ ] **Step 4: Rebuild site after optional edit**

Run:

```bash
npm --prefix /Users/shimon/ws/shimmybezalel run build
```

Expected: build exits with code `0`. If it fails due to the new page, fix the page or remove the optional edit and record the reason in `DECISIONS.md`.

- [ ] **Step 5: Commit website change only if clean and intentional**

If a website edit was made, run:

```bash
git -C /Users/shimon/ws/shimmybezalel status --short
git -C /Users/shimon/ws/shimmybezalel add src/pages/projects/debate-club.astro
git -C /Users/shimon/ws/shimmybezalel commit -m "Add Debate Club project page"
```

If no website edit was made, append to `QUESTIONS.md`:

```markdown

## Website Publication

The Debate Club repo contains `site/debate-club.md` as a website-ready page. Please confirm whether the active public website is `/Users/shimon/ws/shimmybezalel`, `ShimonBezalel/shimonbezalel.github.io`, or another target before production publication.
```

Then commit the question in the Debate Club repo:

```bash
git add QUESTIONS.md
git commit -m "docs: record website publication question"
```

## Task 13: Publish Debate Club Repository

**Files:**
- Remote repository: `ShimonBezalel/debate-club`
- Modify: git remote config

- [ ] **Step 1: Confirm GitHub CLI identity**

Run:

```bash
gh api user --jq .login
```

Expected:

```text
ShimonBezalel
```

If another account is active, run:

```bash
gh auth switch -u ShimonBezalel
gh api user --jq .login
```

- [ ] **Step 2: Create or attach remote**

Run:

```bash
gh repo view ShimonBezalel/debate-club --json name,url,visibility,defaultBranchRef
```

If the repository does not exist, run:

```bash
gh repo create ShimonBezalel/debate-club --public --source . --remote origin --description "Open match protocol for private debate agents and public judge panels."
```

If the repository exists, inspect it before pushing:

```bash
gh repo clone ShimonBezalel/debate-club /tmp/debate-club-remote-check
find /tmp/debate-club-remote-check -maxdepth 2 -type f -print
```

Only proceed if it is empty or compatible with the local work.

- [ ] **Step 3: Push main**

Run:

```bash
git push -u origin main
```

Expected: push succeeds.

- [ ] **Step 4: Confirm repository URL**

Run:

```bash
gh repo view ShimonBezalel/debate-club --web=false --json url,visibility,defaultBranchRef
```

Expected: public repo URL and default branch `main`.

## Task 14: Final Verification And Report

**Files:**
- Modify: `DECISIONS.md` if any deviations occurred.
- No final code changes unless verification exposes a defect.

- [ ] **Step 1: Fresh deterministic verification**

Run:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run cli -- run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/ai_tutors_homework_001.yaml --pro examples/agents/stub_pro --con examples/agents/stub_con --judges examples/judges/stub_panel --out matches/tmp --match-id final-smoke-ai-tutors
npm run cli -- ledger rebuild --matches matches/tmp
npm run cli -- replay matches/tmp/final-smoke-ai-tutors
npm run cli -- leaderboard matches/tmp
```

Expected:

- Typecheck exits with code `0`.
- All tests pass.
- Build exits with code `0`.
- Stub debate writes `matches/tmp/final-smoke-ai-tutors`.
- Replay output contains `# Debate Transcript`.
- Leaderboard output contains `Agent | Wins | Matches`.

- [ ] **Step 2: Check git state and public repo**

Run:

```bash
git status --short --branch
gh repo view ShimonBezalel/debate-club --json url,visibility,defaultBranchRef
```

Expected: no uncommitted Debate Club changes except intentionally ignored `matches/tmp`, repo is public, default branch is `main`.

- [ ] **Step 3: Prepare final report**

Final report must include:

- Repo URL.
- Branch or PR URL if used.
- Website page URL or local artifact path.
- Commands run.
- Test results.
- Example match id.
- Transcript path.
- Scorecard path.
- What works.
- What is stubbed.
- What uses a real SDK or why the SDK is only a boundary.
- What needs API keys or user decisions.
- Open questions from `QUESTIONS.md`.

## Self-Review Checklist

- Spec coverage: Tasks 1-8 implement CLI, schemas, stub agents/judges, runner, ledger, replay, leaderboard, and generated match artifacts. Task 9 covers the optional real SDK boundary. Task 10 covers README, docs, side logs, and site artifact. Task 11 covers tests, CI, and secret hygiene. Task 12 covers website governance. Task 13 covers GitHub publication. Task 14 covers final proof.
- Placeholder scan: This plan avoids undefined task references and gives concrete file paths, commands, expected outputs, and code blocks for core implementation steps.
- Type consistency: The shared names are `Conjecture`, `DebateProtocol`, `AgentCard`, `JudgeCard`, `JudgeVote`, `CompletedMatch`, `DebateAgent`, `DebateJudge`, `runMatch`, `writeMatchArtifacts`, `rebuildLedgerIndex`, `replayMatch`, and `buildLeaderboard`.
