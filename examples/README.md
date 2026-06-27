# Examples

This directory contains deterministic stub fixtures and live OpenAI-powered example harnesses.

## Stub Path

The stub agents and judge run without network access:

```bash
npm run cli -- run --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/ai_tutors_homework_001.yaml --pro examples/agents/stub_pro --con examples/agents/stub_con --judges examples/judges/stub_panel --out matches/tmp --match-id local-stub
```

## Live OpenAI Path

Live examples require `OPENAI_API_KEY` and an explicit `--live` flag:

```bash
npm run cli -- run --live --model gpt-4.1-mini --judge-model gpt-4.1-mini --max-output-tokens 320 --judge-max-output-tokens 900 --judge-limit 1 --protocol examples/protocols/classic_v1.yaml --conjecture examples/conjectures/git_backed_ledgers_001.yaml --pro examples/agents/steelman-v1 --con examples/agents/cross-examiner-v1 --judges examples/judges/panels/openai_epistemic_panel_v1 --out matches --match-id live-git-ledgers-demo
```

Use `--dry-run` instead of `--live` to validate wiring without API calls.
