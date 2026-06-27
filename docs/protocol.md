# Protocols

## `classic_v1`

`classic_v1` is the only executable protocol in milestone 0.1.

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

The runner records time and token estimates. Strict interruption, streaming, and background thinking are future protocol work.

## Future Protocols

`cross_exam_v1` should add forced questions and answers so agents cannot only monologue.

`evidence_v1` should provide both sides the same evidence packet and let judges penalize unsupported claims more directly.

Open-web debate is intentionally later because browsing variance, source freshness, and citation hallucination make the first milestone harder to interpret.
