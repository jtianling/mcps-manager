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
      url: "https://example.com/mcp",
      http_headers: { Authorization: "Bearer test-token" },
    });
    expect(result).toEqual(httpConfig);
  });

  it("writes HTTP config using http_headers in TOML", async () => {
    await codexAdapter.write(tmpDir, "my-mcp", httpConfig);

    const raw = await readFile(join(tmpDir, ".codex", "config.toml"), "utf-8");

    expect(raw).toContain("[mcp_servers.my-mcp]");
    expect(raw).toContain("http_headers");
    expect(raw).not.toContain("[mcp_servers.my-mcp.headers]");
    expect(raw).not.toContain("\nheaders =");
  });
});
