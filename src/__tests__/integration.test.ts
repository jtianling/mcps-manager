import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ServerDefinition, StdioConfig } from "../types.js";
import { claudeCodeAdapter } from "../adapters/claude-code.js";
import { codexAdapter } from "../adapters/codex.js";
import { geminiCliAdapter } from "../adapters/gemini-cli.js";
import { opencodeAdapter } from "../adapters/opencode.js";
import { resolveConfig } from "../utils/resolve-config.js";
import {
  isGitHubRepo,
  isValidInput,
  buildUserMessage,
} from "../services/glm-client.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-e2e-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

const sampleDefinition: ServerDefinition = {
  name: "brave-search",
  source: "https://github.com/anthropics/mcp-brave-search",
  default: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic/mcp-brave-search"],
    env: { BRAVE_API_KEY: "test-key-123" },
  },
  overrides: {},
};

const definitionWithOverrides: ServerDefinition = {
  name: "custom-mcp",
  source: "https://example.com",
  default: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "custom-mcp"],
    env: { API_KEY: "default-key" },
  },
  overrides: {
    "claude-code": {
      transport: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token" },
    },
  },
};

describe("E2E: server add -> deploy to agents -> list -> sync -> remove", () => {
  it("deploys a server definition to all project-level adapters", async () => {
    const adapters = [
      claudeCodeAdapter,
      codexAdapter,
      geminiCliAdapter,
      opencodeAdapter,
    ];

    for (const adapter of adapters) {
      const config = resolveConfig(sampleDefinition, adapter);
      await adapter.write(tmpDir, sampleDefinition.name, config);
    }

    const ccServers = await claudeCodeAdapter.read(tmpDir);
    expect(ccServers["brave-search"]).toBeTruthy();

    const codexServers = await codexAdapter.read(tmpDir);
    expect(codexServers["brave-search"]).toBeTruthy();

    const geminiServers = await geminiCliAdapter.read(tmpDir);
    expect(geminiServers["brave-search"]).toBeTruthy();

    const ocServers = await opencodeAdapter.read(tmpDir);
    expect(ocServers["brave-search"]).toBeTruthy();

    const ocConfig = ocServers["brave-search"] as Record<string, unknown>;
    expect(ocConfig["type"]).toBe("local");
    expect(ocConfig["command"]).toEqual([
      "env",
      "BRAVE_API_KEY=test-key-123",
      "npx",
      "-y",
      "@anthropic/mcp-brave-search",
    ]);
  });

  it("respects overrides per agent", async () => {
    const ccConfig = resolveConfig(definitionWithOverrides, claudeCodeAdapter);
    expect(ccConfig.transport).toBe("http");

    const codexConfig = resolveConfig(definitionWithOverrides, codexAdapter);
    expect(codexConfig.transport).toBe("stdio");
  });

  it("detects conflicts and prevents double-write", async () => {
    await claudeCodeAdapter.write(tmpDir, "brave-search", sampleDefinition.default);
    await expect(
      claudeCodeAdapter.write(tmpDir, "brave-search", sampleDefinition.default),
    ).rejects.toThrow("Conflict");
  });

  it("removes server from all adapters", async () => {
    const adapters = [
      claudeCodeAdapter,
      codexAdapter,
      geminiCliAdapter,
      opencodeAdapter,
    ];

    for (const adapter of adapters) {
      await adapter.write(tmpDir, "brave-search", sampleDefinition.default);
    }

    for (const adapter of adapters) {
      await adapter.remove(tmpDir, "brave-search");
      const has = await adapter.has(tmpDir, "brave-search");
      expect(has).toBe(false);
    }
  });

  it("sync: updates config after central repo change", async () => {
    await claudeCodeAdapter.write(tmpDir, "brave-search", sampleDefinition.default);

    const updatedConfig: StdioConfig = {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@anthropic/mcp-brave-search@2.0"],
      env: { BRAVE_API_KEY: "new-key-456" },
    };

    await claudeCodeAdapter.remove(tmpDir, "brave-search");
    await claudeCodeAdapter.write(tmpDir, "brave-search", updatedConfig);

    const servers = await claudeCodeAdapter.read(tmpDir);
    const config = servers["brave-search"] as Record<string, unknown>;
    expect(config["command"]).toBe("env");
    expect(config["args"]).toEqual([
      "BRAVE_API_KEY=new-key-456",
      "npx",
      "-y",
      "@anthropic/mcp-brave-search@2.0",
    ]);
  });

  it("preserves other content in config files", async () => {
    const geminiPath = join(tmpDir, ".gemini", "settings.json");
    await mkdir(join(tmpDir, ".gemini"), { recursive: true });
    await writeFile(
      geminiPath,
      JSON.stringify({ theme: "dark", language: "en" }),
    );

    await geminiCliAdapter.write(tmpDir, "brave-search", sampleDefinition.default);

    const raw = JSON.parse(await readFile(geminiPath, "utf-8"));
    expect(raw["theme"]).toBe("dark");
    expect(raw["language"]).toBe("en");
    expect(raw["mcpServers"]["brave-search"]).toBeTruthy();
  });
});

describe("Input validation", () => {
  it("recognizes GitHub owner/repo format", () => {
    expect(isGitHubRepo("anthropics/mcp-brave-search")).toBe(true);
    expect(isGitHubRepo("https://github.com/foo/bar")).toBe(false);
    expect(isGitHubRepo("@scope/package")).toBe(false);
    expect(isGitHubRepo("bare-name")).toBe(false);
  });

  it("validates input formats", () => {
    expect(isValidInput("https://example.com")).toEqual({ valid: true });
    expect(isValidInput("anthropics/mcp")).toEqual({ valid: true });
    expect(isValidInput("@scope/pkg")).toEqual({
      valid: false,
      reason: expect.any(String),
    });
    expect(isValidInput("bare-name")).toEqual({
      valid: false,
      reason: expect.any(String),
    });
  });

  it("builds correct user message for GitHub repos", () => {
    const msg = buildUserMessage("anthropics/mcp-brave-search");
    expect(msg).toContain("https://github.com/anthropics/mcp-brave-search");
    expect(msg).toContain("README");
  });

  it("builds correct user message for URLs", () => {
    const msg = buildUserMessage("https://docs.example.com/mcp");
    expect(msg).toContain("https://docs.example.com/mcp");
  });
});
