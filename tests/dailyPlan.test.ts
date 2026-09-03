import { describe, expect, it } from "vitest";
import { EVERGREEN_DOMAINS, loadEvergreenCatalog, validateEvergreenCatalog } from "../src/daily/catalog.js";
import { planDailyMatch } from "../src/daily/plan.js";
import type { Conjecture } from "../src/types/core.js";

function validTopic(id: string): Conjecture {
  return {
    id,
    statement: "Open standards should take priority over short-term capability gains.",
    domain: "ai_software_systems",
    truth_type: "technical_design",
    stance_mode: "forced_random",
    evidence_mode: "no_external_info",
    allowed_tools: { web: false, calculator: false, evidence_pack: false },
    rubric_notes: [
      "compare interoperability with experimentation speed",
      "address migration costs and competitive differentiation"
    ]
  };
}

describe("daily debate planning", () => {
  it("maps the epoch to the first topic and first season", async () => {
    const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");
    const plan = planDailyMatch("2026-09-04", catalog);

    expect(plan).toMatchObject({
      date: "2026-09-04",
      dayIndex: 0,
      season: 1,
      topicIndex: 0,
      proAgent: "steelman-v1",
      conAgent: "cross-examiner-v1"
    });
    expect(plan.matchId).toBe(`daily-2026-09-04-s01-${catalog[0]?.id}`);
  });

  it("starts season two after the 96-topic catalog", async () => {
    const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");

    expect(catalog).toHaveLength(96);
    expect(planDailyMatch("2026-12-09", catalog)).toMatchObject({
      dayIndex: 96,
      season: 2,
      topicIndex: 0
    });
  });

  it("alternates harness sides", async () => {
    const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");

    expect(planDailyMatch("2026-09-05", catalog)).toMatchObject({
      proAgent: "cross-examiner-v1",
      conAgent: "steelman-v1"
    });
  });

  it.each(["2026-09-03", "2026-02-30", "not-a-date"])("rejects invalid or pre-epoch date %s", async (date) => {
    const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");

    expect(() => planDailyMatch(date, catalog)).toThrow();
  });

  it("rejects duplicate topic ids", () => {
    const topic = validTopic("duplicate");

    expect(() => validateEvergreenCatalog([topic, topic])).toThrow(/duplicate/i);
  });

  it("rejects topics that can use external information or tools", () => {
    const topic = validTopic("unsafe_mode");

    expect(() => validateEvergreenCatalog([
      { ...topic, evidence_mode: "web_allowed_with_citations", allowed_tools: { ...topic.allowed_tools, web: true } }
    ])).toThrow(/no_external_info|tools/i);
  });

  it("loads twelve stable topics from each allowed domain", async () => {
    const catalog = await loadEvergreenCatalog("topics/evergreen-v1.yaml");
    const domainRuns = EVERGREEN_DOMAINS.map((domain) => catalog.filter((topic) => topic.domain === domain));

    expect(domainRuns.map((topics) => topics.length)).toEqual([12, 12, 12, 12, 12, 12, 12, 12]);
    expect(catalog.map((topic) => topic.id).slice(0, 2)).toEqual([
      "ai_open_standards_001",
      "ai_small_models_002"
    ]);
    expect(catalog.at(-1)?.id).toBe("ethics_moral_uncertainty_012");
    for (const topic of catalog) {
      expect(topic.evidence_mode).toBe("no_external_info");
      expect(topic.allowed_tools).toEqual({ web: false, calculator: false, evidence_pack: false });
      expect(topic.rubric_notes.length).toBeGreaterThanOrEqual(2);
      expect(topic.rubric_notes.length).toBeLessThanOrEqual(4);
    }
  });
});
