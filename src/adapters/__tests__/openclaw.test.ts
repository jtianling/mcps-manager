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
    const noEnvConfig: StdioConfig = {
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: {},
    };
    await adapter.write(tmpDir, "test", noEnvConfig);
    const servers = await adapter.read(tmpDir);
    expect(servers["test"]).toEqual({
      command: "npx",
      args: ["-y", "pkg"],
    });
  });

  it("writes http config as mcp-remote wrapper", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "my-mcp", httpConfig);
    const servers = await adapter.read(tmpDir);
    expect(servers["my-mcp"]).toEqual({
      command: "npx",
      args: [
        "-y",
        "mcp-remote@latest",
        "https://example.com/mcp",
        "--header",
        "Authorization: Bearer test-token",
      ],
    });
  });

  it("stores config under plugins.entries.acpx.mcpServers", async () => {
    const adapter = await loadAdapter();
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw["plugins"]["entries"]["acpx"]["enabled"]).toBe(true);
    expect(
      raw["plugins"]["entries"]["acpx"]["mcpServers"]["brave-search"],
    ).toBeTruthy();
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

  it("preserves other fields in config", async () => {
    const adapter = await loadAdapter();
    const dir = join(tmpDir, ".openclaw");
    await mkdir(dir, { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify(
        {
          theme: "dark",
          plugins: {
            entries: {
              acpx: { enabled: true, mcpServers: {} },
              other: { enabled: false },
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf-8",
    );
    await adapter.write(tmpDir, "brave-search", stdioConfig);
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw["theme"]).toBe("dark");
    expect(raw["plugins"]["entries"]["other"]["enabled"]).toBe(false);
    expect(
      raw["plugins"]["entries"]["acpx"]["mcpServers"]["brave-search"],
    ).toBeTruthy();
  });

  it("reads JSON5 config with comments and trailing commas", async () => {
    const adapter = await loadAdapter();
    const dir = join(tmpDir, ".openclaw");
    await mkdir(dir, { recursive: true });
    await writeFile(
      configPath,
      `{
  // OpenClaw config
  "plugins": {
    "entries": {
      "acpx": {
        "enabled": true,
        "mcpServers": {
          "test-server": {
            "command": "npx",
            "args": ["-y", "test-pkg"],
          },
        },
      },
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
    expect(
      raw["plugins"]["entries"]["acpx"]["mcpServers"]["brave-search"],
    ).toBeTruthy();
  });
});

describe("OpenClaw Adapter format conversion", () => {
  it("converts from native env field format", async () => {
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

  it("converts from format without env", async () => {
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

  it("returns undefined for unknown format", async () => {
    const adapter = await loadAdapter();
    const result = adapter.fromAgentFormat("test", { unknown: true });
    expect(result).toBeUndefined();
  });

  it("converts stdio config to agent format with env", async () => {
    const adapter = await loadAdapter();
    const result = adapter.toAgentFormat(stdioConfig);
    expect(result).toEqual({
      command: "npx",
      args: ["-y", "@anthropic/mcp-brave-search"],
      env: { BRAVE_API_KEY: "test-key" },
    });
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

  it("converts http config to mcp-remote wrapper", async () => {
    const adapter = await loadAdapter();
    const result = adapter.toAgentFormat(httpConfig);
    expect(result).toEqual({
      command: "npx",
      args: [
        "-y",
        "mcp-remote@latest",
        "https://example.com/mcp",
        "--header",
        "Authorization: Bearer test-token",
      ],
    });
  });

  it("resolves ${VAR} references in args", async () => {
    const adapter = await loadAdapter();
    const result = adapter.toAgentFormat({
      transport: "stdio",
      command: "npx",
      args: ["-y", "mcp-remote", "--header", "Authorization: Bearer ${API_KEY}"],
      env: { API_KEY: "sk-123" },
    });
    expect(result).toEqual({
      command: "npx",
      args: ["-y", "mcp-remote", "--header", "Authorization: Bearer sk-123"],
    });
  });
});
