import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseYaml } from "yaml";
import type { StdioConfig, HttpConfig } from "../../types.js";
import type { AgentAdapter } from "../../types.js";

const stdioConfig: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["-y", "@anthropic/mcp-brave-search"],
  env: { BRAVE_API_KEY: "test-key" },
};

const stdioConfigNoEnv: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["-y", "pkg"],
  env: {},
};

const stdioConfigWithRef: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["-y", "mcp-remote", "--header", "Authorization: Bearer ${API_KEY}"],
  env: { API_KEY: "sk-test-123" },
};

const httpConfig: HttpConfig = {
  transport: "http",
  url: "https://example.com/mcp",
  headers: { Authorization: "Bearer test-token" },
};

let tmpDir: string;
let configPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-hermes-test-"));
  configPath = join(tmpDir, ".hermes", "config.yaml");
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
  const mod = await import("../hermes.js");
  return mod.hermesAdapter;
}

describe("Hermes Adapter", () => {
  it("writes and reads stdio config with env field", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const servers = await adapter.read(tmpDir);
    expect(servers["brave-search"]).toEqual({
      command: "npx",
      args: ["-y", "@anthropic/mcp-brave-search"],
      env: { BRAVE_API_KEY: "test-key" },
    });
  });

  it("writes stdio config without env when env is empty", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "test", stdioConfigNoEnv);
    const servers = await adapter.read(tmpDir);
    expect(servers["test"]).toEqual({
      command: "npx",
      args: ["-y", "pkg"],
    });
  });

  it("writes http config with url and headers (no type field)", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "my-mcp", httpConfig);
    const servers = await adapter.read(tmpDir);
    expect(servers["my-mcp"]).toEqual({
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
    });
  });

  it("writes http config without headers when empty", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "plain-http", {
      transport: "http",
      url: "https://example.com/mcp",
      headers: {},
    });
    const servers = await adapter.read(tmpDir);
    expect(servers["plain-http"]).toEqual({
      url: "https://example.com/mcp",
    });
  });

  it("stores config under top-level mcp_servers (snake_case)", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const raw = parseYaml(await readFile(configPath, "utf-8"));
    expect(raw["mcp_servers"]["brave-search"]).toBeTruthy();
    expect(raw["mcpServers"]).toBeUndefined();
  });

  it("emits YAML, not JSON", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const text = await readFile(configPath, "utf-8");
    expect(text).toContain("mcp_servers:");
    expect(text).toContain("brave-search:");
    expect(text.trim().startsWith("{")).toBe(false);
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

  it("preserves other top-level fields", async () => {
    const adapter = await loadAdapter();
    const dir = join(tmpDir, ".hermes");
    await mkdir(dir, { recursive: true });
    await writeFile(
      configPath,
      "default_model: claude\nmcp_servers: {}\n",
      "utf-8",
    );
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const raw = parseYaml(await readFile(configPath, "utf-8"));
    expect(raw["default_model"]).toBe("claude");
    expect(raw["mcp_servers"]["brave-search"]).toBeTruthy();
  });

  it("returns empty record when config file does not exist", async () => {
    const adapter = await loadAdapter();
    const servers = await adapter.read(tmpDir);
    expect(servers).toEqual({});
  });

  it("creates config directory when writing to non-existent path", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const raw = parseYaml(await readFile(configPath, "utf-8"));
    expect(raw["mcp_servers"]["brave-search"]).toBeTruthy();
  });

  it("substitutes ${VAR} references in args and removes consumed env", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "jina", stdioConfigWithRef);
    const servers = await adapter.read(tmpDir);
    expect(servers["jina"]).toEqual({
      command: "npx",
      args: [
        "-y",
        "mcp-remote",
        "--header",
        "Authorization: Bearer sk-test-123",
      ],
    });
  });

  it("keeps remaining env entries after partial ${VAR} substitution", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "mixed", {
      transport: "stdio",
      command: "npx",
      args: ["-y", "mcp-remote", "--header", "Authorization: Bearer ${API_KEY}"],
      env: { API_KEY: "sk-123", DEBUG: "true" },
    });
    const servers = await adapter.read(tmpDir);
    expect(servers["mixed"]).toEqual({
      command: "npx",
      args: [
        "-y",
        "mcp-remote",
        "--header",
        "Authorization: Bearer sk-123",
      ],
      env: { DEBUG: "true" },
    });
  });
});

describe("Hermes Adapter format conversion", () => {
  it("converts from native stdio format with env", async () => {
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

  it("converts from stdio format without env", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", {
      command: "npx",
      args: ["-y", "pkg"],
    });
    expect(result).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: {},
    });
  });

  it("converts from http format with headers", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", {
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer x" },
    });
    expect(result).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer x" },
    });
  });

  it("converts from http format without headers", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", {
      url: "https://example.com/mcp",
    });
    expect(result).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
      headers: {},
    });
  });

  it("returns undefined for unknown format", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", { unknown: true });
    expect(result).toBeUndefined();
  });

  it("coerces non-string env values to strings", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", {
      command: "npx",
      args: [],
      env: { PORT: 8080, FLAG: true },
    });
    expect(result).toEqual({
      transport: "stdio",
      command: "npx",
      args: [],
      env: { PORT: "8080", FLAG: "true" },
    });
  });
});
