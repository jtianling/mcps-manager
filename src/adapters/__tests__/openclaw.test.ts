import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StdioConfig, HttpConfig } from "../../types.js";
import type { AgentAdapter } from "../../types.js";

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
let configPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-openclaw-test-"));
  configPath = join(tmpDir, ".openclaw", "openclaw.json");
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadAdapter(): Promise<AgentAdapter> {
  vi.doMock("node:os", async (importOriginal) => {
    const original = await importOriginal<typeof import("node:os")>();
    return { ...original, homedir: () => tmpDir };
  });
  const mod = await import("../openclaw.js");
  return mod.openclawAdapter;
}

describe("OpenClaw Adapter", () => {
  it("writes and reads stdio config", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const servers = await adapter.read(tmpDir);
    expect(servers["brave-search"]).toEqual({
      command: "env",
      args: [
        "BRAVE_API_KEY=test-key",
        "npx",
        "-y",
        "@anthropic/mcp-brave-search",
      ],
    });
  });

  it("writes and reads http config with url field", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "my-mcp", httpConfig);
    const servers = await adapter.read(tmpDir);
    expect(servers["my-mcp"]).toEqual({
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
    });
  });

  it("throws on conflict", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    await expect(
      adapter.write(tmpDir, "brave-search", stdioConfig),
    ).rejects.toThrow("Conflict");
  });

  it("removes a server", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    await adapter.remove(tmpDir, "brave-search");
    const has = await adapter.has(tmpDir, "brave-search");
    expect(has).toBe(false);
  });

  it("preserves other servers on write", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "first", stdioConfig);
    await adapter.write(tmpDir, "second", httpConfig);
    const servers = await adapter.read(tmpDir);
    expect(Object.keys(servers)).toEqual(["first", "second"]);
  });

  it("preserves non-mcpServers fields", async () => {
    const adapter = await loadAdapter();
    const dir = join(tmpDir, ".openclaw");
    await mkdir(dir, { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({ theme: "dark", mcpServers: {} }, null, 2) + "\n",
      "utf-8",
    );
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw["theme"]).toBe("dark");
    expect(raw["mcpServers"]["brave-search"]).toBeTruthy();
  });

  it("reads JSON5 config with comments and trailing commas", async () => {
    const adapter = await loadAdapter();
    const dir = join(tmpDir, ".openclaw");
    await mkdir(dir, { recursive: true });
    await writeFile(
      configPath,
      `{
  // MCP servers config
  "mcpServers": {
    "test-server": {
      "command": "npx",
      "args": ["-y", "test-pkg"],
    },
  },
}`,
      "utf-8",
    );
    const servers = await adapter.read(tmpDir);
    expect(servers["test-server"]).toEqual({
      command: "npx",
      args: ["-y", "test-pkg"],
    });
  });

  it("returns empty record when config file does not exist", async () => {
    const adapter = await loadAdapter();
    const servers = await adapter.read(tmpDir);
    expect(servers).toEqual({});
  });

  it("creates config directory when writing to non-existent path", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw["mcpServers"]["brave-search"]).toBeTruthy();
  });
});

describe("OpenClaw Adapter format conversion", () => {
  it("converts from env command format", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", {
      command: "env",
      args: ["KEY=val", "npx", "-y", "pkg"],
    });
    expect(result).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: { KEY: "val" },
    });
  });

  it("converts from legacy env field format", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", {
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

  it("converts from http format with url field", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", {
      url: "https://example.com",
      headers: { Auth: "token" },
    });
    expect(result).toEqual({
      transport: "http",
      url: "https://example.com",
      headers: { Auth: "token" },
    });
  });

  it("returns undefined for unknown format", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", { unknown: true });
    expect(result).toBeUndefined();
  });

  it("converts stdio config to agent format without env", async () => {
    const adapter = await loadAdapter();
    const result = adapter.toAgentFormat({
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: {},
    });
    expect(result).toEqual({
      command: "npx",
      args: ["-y", "pkg"],
    });
  });

  it("converts http config to agent format with url field", async () => {
    const adapter = await loadAdapter();
    const result = adapter.toAgentFormat(httpConfig);
    expect(result).toEqual({
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
    });
  });
});
