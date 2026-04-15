import { describe, it, expect } from "vitest";
import { sniffLocalJson } from "../local-json.js";

describe("sniffLocalJson", () => {
  it("recognizes ServerDefinition shape", () => {
    const raw = {
      name: "brave",
      source: "https://github.com/x/y",
      default: { transport: "stdio", command: "npx", args: ["-y", "brave"], env: {} },
      overrides: {},
    };
    const out = sniffLocalJson(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "brave", source: "https://github.com/x/y" });
  });

  it("recognizes Claude Code mcpServers shape", () => {
    const raw = {
      mcpServers: {
        a: { type: "stdio", command: "npx", args: ["-y", "a"] },
        b: { type: "stdio", command: "npx", args: ["-y", "b"] },
      },
    };
    const out = sniffLocalJson(raw);
    expect(out.map((d) => d.name).sort()).toEqual(["a", "b"]);
    expect(out[0]?.source).toBe("local");
  });

  it("recognizes OpenCode mcp shape (type local, command array)", () => {
    const raw = { mcp: { oc: { type: "local", command: ["npx", "-y", "oc-server"] } } };
    const out = sniffLocalJson(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("oc");
    if (out[0]?.default.transport === "stdio") {
      expect(out[0].default.command).toBe("npx");
      expect(out[0].default.args).toEqual(["-y", "oc-server"]);
    }
  });

  it("recognizes Antigravity serverUrl shape", () => {
    const raw = { mcpServers: { remote: { serverUrl: "https://x/mcp", headers: {} } } };
    const out = sniffLocalJson(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.default.transport).toBe("http");
  });

  it("throws when no known shape matches", () => {
    expect(() => sniffLocalJson({ something: "else" })).toThrow(/recognizable/i);
  });

  it("preserves ServerDefinition.source, assigns 'local' otherwise", () => {
    const withSource = sniffLocalJson({
      name: "x",
      source: "https://custom-url",
      default: { transport: "stdio", command: "c", args: [], env: {} },
      overrides: {},
    });
    expect(withSource[0]?.source).toBe("https://custom-url");

    const withoutSource = sniffLocalJson({
      mcpServers: { x: { command: "c", args: [] } },
    });
    expect(withoutSource[0]?.source).toBe("local");
  });
});
