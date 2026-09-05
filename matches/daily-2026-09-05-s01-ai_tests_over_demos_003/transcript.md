# Debate Transcript

Match: daily-2026-09-05-s01-ai_tests_over_demos_003
Conjecture: A strong evaluation suite is more valuable to an AI product than an impressive public demonstration.
Protocol: classic_v1

## pro_opening

Speaker: pro
Phase: opening
Time used: 3.886s
Token estimate: 180

A strong evaluation suite is more valuable because production AI must be reliable, not merely impressive once. A public demonstration optimizes for capability signaling: curated prompts, favorable conditions, and novelty. An evaluation suite tests repeatability, edge cases, regressions, safety, latency, and cost—turning vague confidence into actionable engineering information.

This does not make demos useless. They are valuable prototypes and communication tools, and they preserve developer freedom to explore unconventional ideas. But production incentives differ: users need predictable behavior, and developers need to know whether a change genuinely improves the system rather than its showcase. Evaluations also support long-term adaptability by revealing where models fail as tasks, data, and policies change. The burden is not to prove demos have no value, but that evaluations create more durable product value; on reliability, protection, and iteration, they do.

## con_opening

Speaker: con
Phase: opening
Time used: 2.878s
Token estimate: 179

The pro case assumes evaluations are strong, relevant, and hard to game—precisely what must be established. A suite can create false confidence through narrow benchmarks, stale tasks, or optimizing to its metrics. A compelling demonstration, while curated, can expose capabilities and failure modes that designers did not anticipate, expanding developer freedom and revealing product direction before formal tests exist. It can also communicate value to users and funders more efficiently than an expensive evaluation program. For early-stage products, that discovery and adoption may matter more than regression tracking. Even in production, evaluations protect users only insofar as they predict real-world behavior; demonstrations can provide qualitative evidence of usability and unexpected risks. Thus evaluations are often indispensable infrastructure, but “more valuable” depends on maturity, task diversity, and whether the suite measures what users actually need.

## pro_rebuttal

Speaker: pro
Phase: rebuttal
Time used: 2.864s
Token estimate: 180

Con correctly identifies that weak evaluations can mislead; “strong” is the operative premise, not a claim that any benchmark suffices. A serious suite should be adversarial, diverse, refreshed, and paired with real-use monitoring, while demos remain valuable for discovery and communication.

But that concession reinforces, rather than defeats, the comparison. A demo can reveal possibility; it cannot efficiently establish reliability, cost, latency, regression resistance, or safety across users. Its apparent usability is also vulnerable to curation. For prototypes, demo value may dominate because the goal is learning and adoption. Once users depend on the system, however, developer freedom is best preserved by measurable feedback—not by shipping surprises—and user protection requires evidence beyond a best-case performance. The suite’s cost is an investment in repeatable iteration and long-term adaptability, making it more valuable for the product overall.

## con_rebuttal

Speaker: con
Phase: rebuttal
Time used: 2.538s
Token estimate: 173

“Strong” quietly imports the conclusion: if a suite is diverse, current, adversarial, and paired with monitoring, it will outperform demos. But those conditions are costly and never complete. Metrics can still miss emergent workflows, distribution shifts, or harms nobody thought to test; monitoring detects failures after users bear them. Demonstrations are not merely marketing: varied, transparent demos can expose novel capabilities and qualitative failure modes that benchmark designers omitted, while preserving freedom to explore before prematurely optimizing a metric. Their lower cost also matters: early adoption, funding, and user feedback may determine whether a product can build the evaluation infrastructure at all. In mature systems, evaluations deserve greater weight for regression control, but the unconditional claim that they are more valuable overall confuses production assurance with product discovery and communication.

## pro_closing

Speaker: pro
Phase: closing
Time used: 2.247s
Token estimate: 179

The claim is comparative, not unconditional: across an AI product’s lifecycle, a strong evaluation suite creates more durable value than an impressive demonstration. Con is right that early prototypes may rationally prioritize demos for discovery, funding, and feedback, and that no suite is complete. But those are reasons to combine demos with evaluations, not to rank demos higher once users depend on the system.

A demo shows possibility; a suite makes change governable. It exposes regressions, cost and latency tradeoffs, safety failures, and distribution-sensitive weaknesses, enabling developers to experiment without unknowingly degrading the product. Monitoring and qualitative demos remain essential for discovering unmeasured risks, but they are complements: monitoring is reactive, while pre-release evaluation reduces user exposure. Thus demos preserve exploratory freedom, whereas evaluations provide the reliability, protection, and adaptive feedback production systems require.

## con_closing

Speaker: con
Phase: closing
Time used: 2.772s
Token estimate: 175

The pro closing narrows the claim to mature, user-dependent systems, but the conjecture says an evaluation suite is more valuable to an AI product—not merely to production assurance. That distinction matters. A suite’s value depends on coverage, freshness, and validity; those are expensive, incomplete, and vulnerable to metric optimization. A transparent demonstration can reveal capabilities, usability problems, and unforeseen failure modes before benchmark designers know what to measure. It also generates adoption, funding, and feedback—the resources needed to build serious evaluations. Even mature products need demos for discovery and communication, while evaluations can create false reassurance when real workflows shift. Therefore, evaluations are indispensable complements and may dominate for regression control, but demos can be more valuable at the stages that determine product direction and survival. The broad ranking remains unproven.
