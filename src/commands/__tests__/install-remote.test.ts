import { describe, it, expect, vi } from "vitest";
import type { AnalysisResult } from "../../install/analyze.js";
import { installFromRemote } from "../install.js";

describe("installFromRemote", () => {
  it("writes ServerDefinition with source preserved and env filled", async () => {
    const analysis: AnalysisResult = {
      name: "pkg",
      default: { transport: "stdio", command: "npx", args: ["-y", "pkg"], env: {} },
      overrides: {},
      requiredEnvVars: ["API_KEY"],
    };
    const write = vi.fn().mockResolvedValue(undefined);
    const upsertBundle = vi.fn().mockResolvedValue(undefined);
    await installFromRemote("owner/repo", {
      analyze: async () => analysis,
      confirm: async () => true,
      askEnvValue: async (k) => (k === "API_KEY" ? "secret" : ""),
      serverExists: () => false,
      writeServerDefinition: write,
      upsertBundle,
      fallbackToManual: async () => {
        throw new Error("should not fallback");
      },
    });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "pkg",
        source: "owner/repo",
        repoName: "repo",
        bundleId: "git:https://github.com/owner/repo",
        default: expect.objectContaining({ env: { API_KEY: "secret" } }),
      }),
    );
    expect(upsertBundle).toHaveBeenCalledWith(
      "git:https://github.com/owner/repo",
      {
        url: "https://github.com/owner/repo",
        members: ["pkg"],
        selectionMode: "all",
      },
    );
  });

  it("falls back to manual flow when analyze throws and user agrees", async () => {
    const fallback = vi.fn().mockResolvedValue(undefined);
    await installFromRemote("owner/repo", {
      analyze: async () => {
        throw new Error("no match");
      },
      confirm: async () => true,
      askEnvValue: async () => "",
      serverExists: () => false,
      writeServerDefinition: vi.fn(),
      upsertBundle: vi.fn(),
      fallbackToManual: fallback,
    });
    expect(fallback).toHaveBeenCalled();
  });

  it("does not write when user does not trust analysis and declines manual", async () => {
    const analysis: AnalysisResult = {
      name: "pkg",
      default: { transport: "stdio", command: "npx", args: [], env: {} },
      overrides: {},
      requiredEnvVars: [],
    };
    const write = vi.fn();
    let called = 0;
    await installFromRemote("owner/repo", {
      analyze: async () => analysis,
      confirm: async () => {
        called++;
        return false;
      },
      askEnvValue: async () => "",
      serverExists: () => false,
      writeServerDefinition: write,
      upsertBundle: vi.fn(),
      fallbackToManual: async () => {
        /* noop */
      },
    });
    expect(write).not.toHaveBeenCalled();
    expect(called).toBeGreaterThanOrEqual(2);
  });
});
