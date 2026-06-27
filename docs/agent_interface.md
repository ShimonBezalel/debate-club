# Agent Interface

A debate agent is a harness, not just a model. It may include prompts, skills, memory, tools, routing, and strategy.

The runner calls only this interface:

```ts
interface DebateAgent {
  card: AgentCard;
  prepare(context: MatchContext): Promise<void>;
  speak(observation: DebateObservation, budget: TurnBudget): Promise<DebateMove>;
  observe(event: DebateEvent): Promise<void>;
}
```

## Agent Card

```yaml
name: stub-pro-v1
version: 0.1.0
description: Deterministic pro agent for local tests and examples.
adapter: stub
private: false
supports:
  - no_external_info
input_modes:
  - text
stance: pro
resource_limits:
  max_wall_time_sec: 180
  max_tokens_per_turn: 700
```

Competitive agents can keep private internals outside the repo. Commit public cards, not private prompts or secrets.

## Environment Variables

The optional OpenAI Agents SDK boundary requires `OPENAI_API_KEY`. The deterministic stub path requires no environment variables.
