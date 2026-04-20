import { CHECKBOX_DEFAULTS } from "../utils/prompt.js";
import type { ServerDefinition } from "../types.js";

export interface Choice {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
}

export function buildChoices(defs: readonly ServerDefinition[]): Choice[] {
  return defs.map((d) => ({
    name: `${d.name} (${d.default.transport}: ${describe(d)})`,
    value: d.name,
    checked: true,
  }));
}

function describe(d: ServerDefinition): string {
  if (d.default.transport === "stdio") return d.default.command;
  return d.default.url;
}

type CheckboxFn = (opts: { message: string; choices: Choice[]; loop?: boolean; theme?: Record<string, unknown> }) => Promise<string[]>;

export async function selectServers(
  defs: readonly ServerDefinition[],
  deps: { checkbox: CheckboxFn },
): Promise<ServerDefinition[]> {
  if (defs.length <= 1) return [...defs];
  const chosen = await deps.checkbox({
    message: `Select servers to install (${defs.length} found):`,
    choices: buildChoices(defs),
    ...CHECKBOX_DEFAULTS,
  });
  const set = new Set(chosen);
  return defs.filter((d) => set.has(d.name));
}
