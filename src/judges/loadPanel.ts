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
