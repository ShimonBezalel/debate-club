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
