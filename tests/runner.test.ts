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
    expect(match.transcript[0]?.turn_id).toBe("pro_opening");
  });
});
