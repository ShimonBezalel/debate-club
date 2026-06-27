import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAiAgentsSdkJudge, type LiveAdapterOptions } from "../adapters/openaiAgentsSdk.js";
import { judgeCardSchema, judgePanelSchema } from "../schemas/cards.js";
import { loadYamlFile } from "../schemas/load.js";
import { createStubJudge } from "./stubJudge.js";
import type { DebateJudge } from "./interface.js";

export async function loadJudgePanel(panelDirectory: string, options: LiveAdapterOptions & { judgeLimit?: number } = {}): Promise<DebateJudge[]> {
  const panel = judgePanelSchema.parse(await loadYamlFile(join(panelDirectory, "panel.yaml")));
  const judges: DebateJudge[] = [];
  for (const judgeFile of panel.judges.slice(0, options.judgeLimit ?? panel.judges.length)) {
    const card = judgeCardSchema.parse(await loadYamlFile(join(panelDirectory, judgeFile)));
    if (card.adapter === "stub") {
      judges.push(createStubJudge(card));
      continue;
    }
    if (card.adapter === "openai-agents-sdk") {
      judges.push(await createOpenAiAgentsSdkJudge(card, panelDirectory, options));
      continue;
    }
    throw new Error(`Unsupported judge adapter '${card.adapter}'.`);
  }
  return judges;
}

export function moduleDirectory(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}
