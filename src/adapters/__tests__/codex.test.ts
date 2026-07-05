import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { HttpConfig, StdioConfig } from "../../types.js";
import { codexAdapter } from "../codex.js";

const nativeEnvConfig: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["@pkg"],
  env: { FOO: "bar" },
};

const emptyEnvConfig: StdioConfig = {
  transport: "stdio",
  command: "npx",
  args: ["@pkg"],
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

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-codex-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

describe("Codex Adapter stdio native env", () => {
  it("toAgentFormat stdio - env uses native table", () => {
    const result = codexAdapter.toAgentFormat(nativeEnvConfig);

    expect(result).toEqual({
      command: "npx",
      args: ["@pkg"],
      env: { FOO: "bar" },
    });
  });

  it("toAgentFormat stdio - omits empty env", () => {
    const result = codexAdapter.toAgentFormat(emptyEnvConfig);

    expect(result).toEqual({
      command: "npx",
      args: ["@pkg"],
    });
    expect(result).not.toHaveProperty("env");
  });

  it("toAgentFormat stdio - expands referenced env and preserves remaining env natively", () => {
    const result = codexAdapter.toAgentFormat(mixedEnvConfig);

    expect(result).toEqual({
      command: "npx",
      args: ["@pkg", "--token=secret"],
      env: { DEBUG: "1" },
    });
  });

  it("fromAgentFormat stdio - reads native env", () => {
    const result = codexAdapter.fromAgentFormat("test", {
      command: "npx",
      args: ["@pkg"],
      env: { FOO: "bar" },
    });

    expect(result).toEqual(nativeEnvConfig);
  });

  it("fromAgentFormat stdio - migrates legacy env wrapper", () => {
    const result = codexAdapter.fromAgentFormat("test", {
      command: "env",
      args: ["FOO=bar", "npx", "@pkg"],
    });

    expect(result).toEqual(nativeEnvConfig);
  });

  it("round-trips stdio config with env", () => {
    const raw = codexAdapter.toAgentFormat(nativeEnvConfig);
    const result = codexAdapter.fromAgentFormat(
      "test",
      raw as Record<string, unknown>,
    );

    expect(result).toEqual(nativeEnvConfig);
  });

  it("write smoke test emits native env TOML without env wrapper command", async () => {
    await codexAdapter.write(tmpDir, "native-env", mixedEnvConfig);

    const raw = await readFile(join(tmpDir, ".codex", "config.toml"), "utf-8");

    expect(raw).toMatch(/^\[mcp_servers(?:\."native-env"|\.native-env)\]/m);
    expect(raw).toContain('command = "npx"');
    expect(raw).toMatch(
      /env\s*=\s*\{|^\[mcp_servers(?:\."native-env"|\.native-env)\.env\]/m,
    );
    expect(raw).not.toContain('command = "env"');
  });
});

describe("Codex Adapter http", () => {
  it("converts HTTP config to Codex StreamableHttp format", () => {
    const result = codexAdapter.toAgentFormat(httpConfig);

    expect(result).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
      http_headers: { Authorization: "Bearer test-token" },
    });
    expect(result).not.toHaveProperty("headers");
  });

  it("converts HTTP config from Codex StreamableHttp format", () => {
    const result = codexAdapter.fromAgentFormat("my-mcp", {
      url: "https://example.com/mcp",
      http_headers: { Authorization: "Bearer test-token" },
    });

    expect(result).toEqual(httpConfig);
  });

  it("round-trips HTTP config through Codex agent format", () => {
    const raw = codexAdapter.toAgentFormat(httpConfig);
    const result = codexAdapter.fromAgentFormat(
      "my-mcp",
      raw as Record<string, unknown>,
    );

    expect(raw).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
      http_headers: { Authorization: "Bearer test-token" },
    });
    expect(result).toEqual(httpConfig);
  });

  it("writes HTTP config using http_headers in TOML", async () => {
    await codexAdapter.write(tmpDir, "my-mcp", httpConfig);

    const raw = await readFile(join(tmpDir, ".codex", "config.toml"), "utf-8");

    expect(raw).toContain("[mcp_servers.my-mcp]");
    expect(raw).toContain('type = "streamable-http"');
    expect(raw).toContain("http_headers");
    expect(raw).not.toContain("[mcp_servers.my-mcp.headers]");
    expect(raw).not.toContain("\nheaders =");
  });

  it("omits http_headers entirely when headers are empty", () => {
    const result = codexAdapter.toAgentFormat({
      transport: "http",
      url: "https://example.com/mcp",
      headers: {},
    });

    expect(result).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
    });
    expect(result).not.toHaveProperty("http_headers");
  });

  it("reads http entry without http_headers as empty headers", () => {
    const result = codexAdapter.fromAgentFormat("my-mcp", {
      url: "https://example.com/mcp",
    });

    expect(result).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
      headers: {},
    });
  });
});

describe("Codex Adapter bearer_token_env_var", () => {
  const bearerConfig: HttpConfig = {
    transport: "http",
    url: "https://example.com/mcp",
    headers: { Authorization: "Bearer plain-token", "X-Extra": "1" },
    bearerTokenEnvVar: "CROSS_AGENT_TEAMS_MCP_TOKEN",
  };

  it("writes bearer_token_env_var and never a plaintext Authorization header", () => {
    const result = codexAdapter.toAgentFormat(bearerConfig);

    expect(result).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
      bearer_token_env_var: "CROSS_AGENT_TEAMS_MCP_TOKEN",
      http_headers: { "X-Extra": "1" },
    });
  });

  it("omits http_headers when Authorization was the only header", () => {
    const result = codexAdapter.toAgentFormat({
      ...bearerConfig,
      headers: { Authorization: "Bearer plain-token" },
    });

    expect(result).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
      bearer_token_env_var: "CROSS_AGENT_TEAMS_MCP_TOKEN",
    });
  });

  it("reads bearer_token_env_var back", () => {
    const result = codexAdapter.fromAgentFormat("my-mcp", {
      url: "https://example.com/mcp",
      bearer_token_env_var: "CROSS_AGENT_TEAMS_MCP_TOKEN",
    });

    expect(result).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
      headers: {},
      bearerTokenEnvVar: "CROSS_AGENT_TEAMS_MCP_TOKEN",
    });
  });

  it("round-trips bearerTokenEnvVar without resurrecting Authorization", () => {
    const raw = codexAdapter.toAgentFormat(bearerConfig);
    const result = codexAdapter.fromAgentFormat(
      "my-mcp",
      raw as Record<string, unknown>,
    );

    expect(result).toEqual({
      transport: "http",
      url: "https://example.com/mcp",
      headers: { "X-Extra": "1" },
      bearerTokenEnvVar: "CROSS_AGENT_TEAMS_MCP_TOKEN",
    });
  });
});

describe("Codex Adapter experimental_use_rmcp_client", () => {
  it("adds the top-level switch when writing an http server to a fresh file", async () => {
    await codexAdapter.write(tmpDir, "my-mcp", httpConfig);

    const raw = await readFile(join(tmpDir, ".codex", "config.toml"), "utf-8");

    expect(raw).toMatch(/^experimental_use_rmcp_client = true$/m);
    const reread = await codexAdapter.read(tmpDir);
    expect(reread).toHaveProperty("my-mcp");
  });

  it("leaves an existing false value untouched", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(join(tmpDir, ".codex"), { recursive: true });
    await writeFile(
      join(tmpDir, ".codex", "config.toml"),
      "experimental_use_rmcp_client = false\n",
      "utf-8",
    );

    await codexAdapter.write(tmpDir, "my-mcp", httpConfig);

    const raw = await readFile(join(tmpDir, ".codex", "config.toml"), "utf-8");
    expect(raw).toMatch(/^experimental_use_rmcp_client = false$/m);
    expect(raw).not.toMatch(/^experimental_use_rmcp_client = true$/m);
  });

  it("does not add the switch for stdio servers", async () => {
    await codexAdapter.write(tmpDir, "native-env", nativeEnvConfig);

    const raw = await readFile(join(tmpDir, ".codex", "config.toml"), "utf-8");
    expect(raw).not.toContain("experimental_use_rmcp_client");
  });
});

describe("Codex Adapter globalDir", () => {
  it("declares the user home directory as global write target", async () => {
    const { homedir } = await import("node:os");
    expect(codexAdapter.globalDir?.()).toBe(homedir());
  });
});
