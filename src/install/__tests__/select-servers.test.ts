import { describe, it, expect, vi } from "vitest";
import { buildChoices, selectServers } from "../select-servers.js";
import type { ServerDefinition } from "../../types.js";

const defs: ServerDefinition[] = [
  {
    name: "a",
    source: "local",
    default: { transport: "stdio", command: "c", args: [], env: {} },
    overrides: {},
  },
  {
    name: "b",
    source: "local",
    default: { transport: "stdio", command: "c", args: [], env: {} },
    overrides: {},
  },
];

describe("buildChoices", () => {
  it("maps each definition to a checked choice", () => {
    expect(buildChoices(defs)).toEqual([
      { name: "a (stdio: c)", value: "a", checked: true },
      { name: "b (stdio: c)", value: "b", checked: true },
    ]);
  });
});

describe("selectServers", () => {
  it("returns all entries when single candidate (no prompt)", async () => {
    const checkbox = vi.fn();
    const out = await selectServers([defs[0]!], { checkbox });
    expect(out).toEqual([defs[0]]);
    expect(checkbox).not.toHaveBeenCalled();
  });

  it("delegates to checkbox for multi-candidate, returns selected", async () => {
    const checkbox = vi.fn().mockResolvedValue(["b"]);
    const out = await selectServers(defs, { checkbox });
    expect(checkbox).toHaveBeenCalled();
    expect(out.map((d) => d.name)).toEqual(["b"]);
  });
});
