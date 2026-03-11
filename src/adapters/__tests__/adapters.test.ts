import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StdioConfig, HttpConfig } from "../../types.js";
import { claudeCodeAdapter } from "../claude-code.js";
import { codexCliAdapter } from "../codex-cli.js";
import { geminiCliAdapter } from "../gemini-cli.js";
import { opencodeAdapter } from "../opencode.js";

const stdioConfig: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["-y", "@anthropic/mcp-brave-search"],
  env: { BRAVE_API_KEY: "test-key" },
};

const httpConfig: HttpConfig = {
  transport: "http",
  url: "https://example.com/mcp",
  headers: { Authorization: "Bearer test-token" },
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

describe("Claude Code Adapter", () => {
  it("writes and reads stdio config", async () => {
    await claudeCodeAdapter.write(tmpDir, "brave-search", stdioConfig);
    const servers = await claudeCodeAdapter.read(tmpDir);
    expect(servers["brave-search"]).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "@anthropic/mcp-brave-search"],
      env: { BRAVE_API_KEY: "test-key" },
    });
  });

  it("writes and reads http config", async () => {
    await claudeCodeAdapter.write(tmpDir, "my-mcp", httpConfig);
    const servers = await claudeCodeAdapter.read(tmpDir);
    expect(servers["my-mcp"]).toEqual({
      type: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
    });
  });

  it("throws on conflict", async () => {
    await claudeCodeAdapter.write(tmpDir, "brave-search", stdioConfig);
    await expect(
      claudeCodeAdapter.write(tmpDir, "brave-search", stdioConfig),
    ).rejects.toThrow("Conflict");
  });

  it("removes a server", async () => {
    await claudeCodeAdapter.write(tmpDir, "brave-search", stdioConfig);
    await claudeCodeAdapter.remove(tmpDir, "brave-search");
    const has = await claudeCodeAdapter.has(tmpDir, "brave-search");
    expect(has).toBe(false);
  });

  it("preserves other servers on write", async () => {
    await claudeCodeAdapter.write(tmpDir, "first", stdioConfig);
    await claudeCodeAdapter.write(tmpDir, "second", httpConfig);
    const servers = await claudeCodeAdapter.read(tmpDir);
    expect(Object.keys(servers)).toEqual(["first", "second"]);
  });

  it("converts from agent format", () => {
    const result = claudeCodeAdapter.fromAgentFormat("test", {
      type: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: { KEY: "val" },
    });
    expect(result).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: { KEY: "val" },
    });
  });
});

describe("Codex CLI Adapter", () => {
  it("writes and reads stdio config as TOML", async () => {
    await codexCliAdapter.write(tmpDir, "brave-search", stdioConfig);
    const servers = await codexCliAdapter.read(tmpDir);
    expect(servers["brave-search"]).toBeTruthy();

    const raw = await readFile(
      join(tmpDir, ".codex", "config.toml"),
      "utf-8",
    );
    expect(raw).toContain("[mcp_servers.brave-search]");
  });

  it("throws on conflict", async () => {
    await codexCliAdapter.write(tmpDir, "brave-search", stdioConfig);
    await expect(
      codexCliAdapter.write(tmpDir, "brave-search", stdioConfig),
    ).rejects.toThrow("Conflict");
  });

  it("removes a server", async () => {
    await codexCliAdapter.write(tmpDir, "brave-search", stdioConfig);
    await codexCliAdapter.remove(tmpDir, "brave-search");
    const has = await codexCliAdapter.has(tmpDir, "brave-search");
    expect(has).toBe(false);
  });
});

describe("Gemini CLI Adapter", () => {
  it("writes and reads stdio config", async () => {
    await geminiCliAdapter.write(tmpDir, "brave-search", stdioConfig);
    const servers = await geminiCliAdapter.read(tmpDir);
    expect(servers["brave-search"]).toEqual({
      command: "npx",
      args: ["-y", "@anthropic/mcp-brave-search"],
      env: { BRAVE_API_KEY: "test-key" },
    });
  });

  it("preserves non-MCP fields", async () => {
    const { writeJsonFile } = await import("../json-file.js");
    const filePath = join(tmpDir, ".gemini", "settings.json");
    await writeJsonFile(filePath, { theme: "dark", mcpServers: {} });

    await geminiCliAdapter.write(tmpDir, "brave-search", stdioConfig);

    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    expect(raw["theme"]).toBe("dark");
    expect(raw["mcpServers"]["brave-search"]).toBeTruthy();
  });
});

describe("OpenCode Adapter", () => {
  it("writes stdio config with array command", async () => {
    await opencodeAdapter.write(tmpDir, "brave-search", stdioConfig);
    const servers = await opencodeAdapter.read(tmpDir);
    expect(servers["brave-search"]).toEqual({
      type: "local",
      command: ["npx", "-y", "@anthropic/mcp-brave-search"],
      environment: { BRAVE_API_KEY: "test-key" },
    });
  });

  it("writes http config with remote type", async () => {
    await opencodeAdapter.write(tmpDir, "my-mcp", httpConfig);
    const servers = await opencodeAdapter.read(tmpDir);
    expect(servers["my-mcp"]).toEqual({
      type: "remote",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
    });
  });

  it("converts from agent format (local)", () => {
    const result = opencodeAdapter.fromAgentFormat("test", {
      type: "local",
      command: ["npx", "-y", "pkg"],
      environment: { KEY: "val" },
    });
    expect(result).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: { KEY: "val" },
    });
  });

  it("converts from agent format (remote)", () => {
    const result = opencodeAdapter.fromAgentFormat("test", {
      type: "remote",
      url: "https://example.com",
      headers: {},
    });
    expect(result).toEqual({
      transport: "http",
      url: "https://example.com",
      headers: {},
    });
  });
});
