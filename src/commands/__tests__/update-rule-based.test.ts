import { describe, it, expect, vi } from "vitest";
import { updateSingle, updateAll } from "../update.js";
import type { AnalysisResult } from "../../install/analyze.js";
import type { ServerDefinition } from "../../types.js";

const existing: ServerDefinition = {
  name: "pkg",
  source: "owner/repo",
  default: { transport: "stdio", command: "npx", args: ["-y", "pkg"], env: { API_KEY: "kept" } },
  overrides: {},
};

const newAnalysis: AnalysisResult = {
  name: "pkg",
  default: { transport: "stdio", command: "npx", args: ["-y", "pkg@2"], env: {} },
  overrides: {},
  requiredEnvVars: ["API_KEY"],
};

describe("updateSingle", () => {
  it("merges analysis, preserves existing env values", async () => {
    const write = vi.fn();
    const res = await updateSingle("pkg", {
      serverExists: () => true,
      readServerDefinition: async () => existing,
      analyze: async () => newAnalysis,
      confirm: async () => true,
      writeServerDefinition: write,
    });
    expect(res).toBe("updated");
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "pkg",
        default: expect.objectContaining({ env: { API_KEY: "kept" } }),
      }),
    );
  });

  it("reports 'missing' when server not in store", async () => {
    const res = await updateSingle("nope", {
      serverExists: () => false,
      readServerDefinition: async () => undefined,
      analyze: async () => newAnalysis,
      confirm: async () => true,
      writeServerDefinition: vi.fn(),
    });
    expect(res).toBe("missing");
  });

  it("reports 'no-source' when source is local", async () => {
    const local: ServerDefinition = { ...existing, source: "local" };
    const res = await updateSingle("pkg", {
      serverExists: () => true,
      readServerDefinition: async () => local,
      analyze: async () => newAnalysis,
      confirm: async () => true,
      writeServerDefinition: vi.fn(),
    });
    expect(res).toBe("no-source");
  });
});

describe("updateAll", () => {
  it("continues through failures and returns summary", async () => {
    const defs: ServerDefinition[] = [
      { ...existing, name: "a" },
      { ...existing, name: "b" },
      { ...existing, name: "c", source: "local" },
    ];
    let callCount = 0;
    const summary = await updateAll({
      listServerDefinitions: async () => defs,
      updateSingle: async (name) => {
        callCount++;
        if (name === "b") throw new Error("network");
        if (name === "c") return "no-source";
        return "updated";
      },
    });
    expect(callCount).toBe(3);
    expect(summary).toEqual({ updated: 1, skipped: 1, failed: 1 });
  });
});
