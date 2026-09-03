import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
}

interface Workflow {
  name: string;
  on: {
    schedule: Array<{ cron: string }>;
    workflow_dispatch: { inputs: Record<string, unknown> };
  };
  concurrency: { group: string; "cancel-in-progress": boolean };
  permissions: Record<string, string>;
  jobs: Record<string, { environment?: unknown; steps?: WorkflowStep[] }>;
}

async function loadWorkflow(path: string): Promise<Workflow> {
  return parse(await readFile(path, "utf8")) as Workflow;
}

describe("daily debate workflow", () => {
  it("serializes one scheduled and manually recoverable daily writer", async () => {
    const workflow = await loadWorkflow(".github/workflows/daily-debate.yml");

    expect(workflow.on.schedule).toEqual([{ cron: "17 3 * * *" }]);
    expect(workflow.on.workflow_dispatch.inputs).toHaveProperty("date");
    expect(workflow.concurrency).toEqual({ group: "daily-debate", "cancel-in-progress": false });
    expect(workflow.permissions).toMatchObject({ contents: "write", pages: "write", "id-token": "write" });
  });

  it("scopes the API key to the economical live match step", async () => {
    const workflow = await loadWorkflow(".github/workflows/daily-debate.yml");
    const steps = workflow.jobs.build?.steps ?? [];
    const liveStep = steps.find((step) => step.name === "Run daily debate");

    expect(liveStep?.env).toEqual({ OPENAI_API_KEY: "${{ secrets.OPENAI_API_KEY }}" });
    expect(liveStep?.run).toContain("--model gpt-5.6-luna");
    expect(liveStep?.run).toContain("--judge-model gpt-5.6-luna");
    expect(liveStep?.run).toContain("--reasoning-effort none");
    expect(liveStep?.run).toContain("--max-output-tokens 260");
    expect(liveStep?.run).toContain("--judge-max-output-tokens 700");
    expect(steps.filter((step) => step.env?.OPENAI_API_KEY)).toHaveLength(1);
  });

  it("validates before a non-forced canonical push and deploys the built viewer", async () => {
    const workflow = await loadWorkflow(".github/workflows/daily-debate.yml");
    const steps = workflow.jobs.build?.steps ?? [];
    const commands = steps.flatMap((step) => step.run ? [step.run] : []);
    const commitStep = steps.find((step) => step.name === "Commit daily ledger entry");
    const pushStep = steps.find((step) => step.name === "Push daily ledger entry");

    expect(commands).toContain("npm test");
    expect(commands).toContain("npm run typecheck");
    expect(commands).toContain("npm audit --omit=dev");
    expect(commands).toContain("npm run public-db:validate");
    expect(commitStep?.run).toContain("git add matches/");
    expect(commitStep?.run).toContain("git pull --rebase origin main");
    expect(pushStep?.run).toContain("git push origin HEAD:main");
    expect(pushStep?.run).not.toContain("--force");
    expect(steps.some((step) => step.uses === "actions/upload-pages-artifact@v4")).toBe(true);
    expect(workflow.jobs.deploy?.steps?.some((step) => step.uses === "actions/deploy-pages@v4")).toBe(true);
    expect(workflow.jobs.deploy?.environment).toMatchObject({ name: "github-pages" });
  });

  it("keeps the ordinary Pages path behind the production audit", async () => {
    const workflow = await loadWorkflow(".github/workflows/pages.yml");
    const commands = workflow.jobs.build?.steps?.flatMap((step) => step.run ? [step.run] : []) ?? [];

    expect(commands).toContain("npm audit --omit=dev");
  });
});
