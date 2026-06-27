# OpenAI Agents SDK Example

This directory demonstrates the public card shape for a private Debate Club harness that would use the optional OpenAI Agents SDK adapter.

The deterministic runner does not load this adapter in CI. To experiment locally, install the optional SDK package and set `OPENAI_API_KEY` in your shell. Do not commit `.env` files, private prompts, or model transcripts that contain secrets.

The 0.1 adapter intentionally stops before live speech generation unless spend controls and prompts are configured by the operator.
