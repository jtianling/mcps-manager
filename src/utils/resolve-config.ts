import type { AgentAdapter, DefaultConfig, ServerDefinition } from "../types.js";

export function resolveConfig(
  definition: ServerDefinition,
  adapter: AgentAdapter,
): DefaultConfig {
  const override = definition.overrides[adapter.id];
  if (override) {
    const base = definition.default;
    return { ...base, ...override } as DefaultConfig;
  }
  return definition.default;
}
