import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import type { HttpConfig, StdioConfig } from "../../types.js";
import { kimiCodeAdapter } from "../kimi-code.js";

const stdioConfig: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["-y", "@pkg"],
  env: { FOO: "bar" },
};

const emptyEnvConfig: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["-y", "@pkg"],
  env: {},
};

const mixedEnvConfig: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["@pkg", "--token=${API_KEY}"],
  env: { API_KEY: "secret", DEBUG: "1" },
};

const httpConfig: HttpConfig = {
  transport: "http",
  url: "https://example.com/mcp",
  headers: { Authorization: "Bearer test-token" },
};

const bearerConfig: HttpConfig = {
  transport: "http",
  url: "http://127.0.0.1:9100/mcp",
  headers: { Authorization: "Bearer plain-token", "X-Extra": "1" },
  bearerTokenEnvVar: "CROSS_AGENT_TEAMS_MCP_TOKEN",
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-kimi-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

describe("Kimi Code Adapter stdio", () => {
  it("emits an explicit transport discriminator and a native env table", () => {
    expect(kimiCodeAdapter.toAgentFormat(stdioConfig)).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "@pkg"],
      env: { FOO: "bar" },
    });
  });

  it("omits env when empty", () => {
    const result = kimiCodeAdapter.toAgentFormat(emptyEnvConfig);

    expect(result).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "@pkg"],
    });
    expect(result).not.toHaveProperty("env");
  });

  it("expands referenced env into args and keeps the rest in env", () => {
    expect(kimiCodeAdapter.toAgentFormat(mixedEnvConfig)).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["@pkg", "--token=secret"],
      env: { DEBUG: "1" },
    });
  });

  it("infers stdio when transport is absent", () => {
    expect(
      kimiCodeAdapter.fromAgentFormat("test", {
        command: "npx",
        args: ["-y", "@pkg"],
        env: { FOO: "bar" },
      }),
    ).toEqual(stdioConfig);
  });

  it("migrates a legacy env-command wrapper", () => {
    expect(
      kimiCodeAdapter.fromAgentFormat("test", {
        transport: "stdio",
        command: "env",
        args: ["FOO=bar", "npx", "-y", "@pkg"],
      }),
    ).toEqual(stdioConfig);
  });

  it("round-trips stdio config", () => {
    const raw = kimiCodeAdapter.toAgentFormat(stdioConfig);
    expect(
      kimiCodeAdapter.fromAgentFormat("test", raw as Record<string, unknown>),
    ).toEqual(stdioConfig);
  });
});

describe("Kimi Code Adapter http", () => {
  it("writes headers under the native headers key", () => {
    expect(kimiCodeAdapter.toAgentFormat(httpConfig)).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
    });
  });

  it("omits headers when empty", () => {
    const result = kimiCodeAdapter.toAgentFormat({
      transport: "http",
      url: "https://example.com/mcp",
      headers: {},
    });

    expect(result).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
    });
    expect(result).not.toHaveProperty("headers");
  });

  it("infers http when transport is absent", () => {
    expect(
      kimiCodeAdapter.fromAgentFormat("my-mcp", {
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer test-token" },
      }),
    ).toEqual(httpConfig);
  });

  it("reads an sse entry back as http so url and headers survive", () => {
    expect(
      kimiCodeAdapter.fromAgentFormat("my-mcp", {
        transport: "sse",
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer test-token" },
      }),
    ).toEqual(httpConfig);
  });
});

describe("Kimi Code Adapter bearerTokenEnvVar", () => {
  it("writes bearerTokenEnvVar and never a plaintext Authorization header", () => {
    expect(kimiCodeAdapter.toAgentFormat(bearerConfig)).toEqual({
      transport: "http",
      url: "http://127.0.0.1:9100/mcp",
      bearerTokenEnvVar: "CROSS_AGENT_TEAMS_MCP_TOKEN",
      headers: { "X-Extra": "1" },
    });
  });

  it("omits headers when Authorization was the only one", () => {
    const result = kimiCodeAdapter.toAgentFormat({
      ...bearerConfig,
      headers: { Authorization: "Bearer plain-token" },
    });

    expect(result).toEqual({
      transport: "http",
      url: "http://127.0.0.1:9100/mcp",
      bearerTokenEnvVar: "CROSS_AGENT_TEAMS_MCP_TOKEN",
    });
    expect(result).not.toHaveProperty("headers");
  });

  it("round-trips bearerTokenEnvVar without resurrecting Authorization", () => {
    const raw = kimiCodeAdapter.toAgentFormat(bearerConfig);

    expect(
      kimiCodeAdapter.fromAgentFormat("my-mcp", raw as Record<string, unknown>),
    ).toEqual({
      transport: "http",
      url: "http://127.0.0.1:9100/mcp",
      headers: { "X-Extra": "1" },
      bearerTokenEnvVar: "CROSS_AGENT_TEAMS_MCP_TOKEN",
    });
  });
});

describe("Kimi Code Adapter enabled flag", () => {
  it("omits enabled when the config does not declare it", () => {
    expect(kimiCodeAdapter.toAgentFormat(httpConfig)).not.toHaveProperty(
      "enabled",
    );
    expect(kimiCodeAdapter.toAgentFormat(stdioConfig)).not.toHaveProperty(
      "enabled",
    );
  });

  it("writes a disabled stdio entry that can mask an inherited one", () => {
    expect(
      kimiCodeAdapter.toAgentFormat({ ...stdioConfig, enabled: false }),
    ).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "@pkg"],
      env: { FOO: "bar" },
      enabled: false,
    });
  });

  it("writes enabled on http entries too", () => {
    expect(
      kimiCodeAdapter.toAgentFormat({ ...httpConfig, enabled: false }),
    ).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
      enabled: false,
    });
  });

  it("round-trips enabled:false so a refresh does not re-enable the entry", () => {
    const raw = kimiCodeAdapter.toAgentFormat({ ...httpConfig, enabled: false });

    expect(
      kimiCodeAdapter.fromAgentFormat("my-mcp", raw as Record<string, unknown>),
    ).toEqual({ ...httpConfig, enabled: false });
  });

  it("round-trips enabled:false through the env-command wrapper path", () => {
    expect(
      kimiCodeAdapter.fromAgentFormat("test", {
        transport: "stdio",
        command: "env",
        args: ["FOO=bar", "npx", "-y", "@pkg"],
        enabled: false,
      }),
    ).toEqual({ ...stdioConfig, enabled: false });
  });

  it("ignores a non-boolean enabled value", () => {
    const result = kimiCodeAdapter.fromAgentFormat("my-mcp", {
      transport: "http",
      url: "https://example.com/mcp",
      enabled: "false",
    });

    expect(result).not.toHaveProperty("enabled");
  });

  it("persists a disabled entry to disk", async () => {
    await kimiCodeAdapter.write(tmpDir, "channel", {
      ...stdioConfig,
      enabled: false,
    });

    const servers = await kimiCodeAdapter.read(tmpDir);
    expect(servers["channel"]).toHaveProperty("enabled", false);
  });
});

describe("Kimi Code Adapter file handling", () => {
  it("writes under .kimi-code/mcp.json wrapped in mcpServers", async () => {
    await kimiCodeAdapter.write(tmpDir, "my-mcp", httpConfig);

    const raw = JSON.parse(
      await readFile(join(tmpDir, ".kimi-code", "mcp.json"), "utf-8"),
    );
    expect(raw["mcpServers"]["my-mcp"]["url"]).toBe("https://example.com/mcp");
  });

  it("throws on conflict", async () => {
    await kimiCodeAdapter.write(tmpDir, "my-mcp", httpConfig);
    await expect(
      kimiCodeAdapter.write(tmpDir, "my-mcp", httpConfig),
    ).rejects.toThrow("Conflict");
  });

  it("removes a server", async () => {
    await kimiCodeAdapter.write(tmpDir, "my-mcp", httpConfig);
    await kimiCodeAdapter.remove(tmpDir, "my-mcp");

    expect(await kimiCodeAdapter.has(tmpDir, "my-mcp")).toBe(false);
  });

  it("preserves other servers and unrelated top-level keys on write", async () => {
    const { writeJsonFile } = await import("../json-file.js");
    const filePath = join(tmpDir, ".kimi-code", "mcp.json");
    await writeJsonFile(filePath, { $schema: "./schema.json", mcpServers: {} });

    await kimiCodeAdapter.write(tmpDir, "first", stdioConfig);
    await kimiCodeAdapter.write(tmpDir, "second", httpConfig);

    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    expect(raw["$schema"]).toBe("./schema.json");
    expect(Object.keys(raw["mcpServers"])).toEqual(["first", "second"]);
  });

  it("declares the home dir as global target, resolving to ~/.kimi-code/mcp.json", () => {
    expect(kimiCodeAdapter.globalDir?.()).toBe(homedir());
    expect(kimiCodeAdapter.configPath(homedir())).toBe(
      join(homedir(), ".kimi-code", "mcp.json"),
    );
  });
});
