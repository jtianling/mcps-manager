import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ServerDefinition } from "../types.js";
import {
  writeServerDefinition,
  listServerDefinitions,
} from "../utils/server-store.js";
import { paths } from "../utils/paths.js";

let originalBaseDir: string;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-list-"));
  originalBaseDir = paths.baseDir;
  Object.assign(paths, {
    baseDir: tmpDir,
    serversDir: join(tmpDir, "servers"),
    configFile: join(tmpDir, "config.json"),
    serverFile: (name: string) => join(tmpDir, "servers", `${name}.json`),
  });
  await mkdir(join(tmpDir, "servers"), { recursive: true });
});

afterEach(async () => {
  Object.assign(paths, {
    baseDir: originalBaseDir,
    serversDir: join(originalBaseDir, "servers"),
    configFile: join(originalBaseDir, "config.json"),
    serverFile: (name: string) =>
      join(originalBaseDir, "servers", `${name}.json`),
  });
  await rm(tmpDir, { recursive: true });
});

describe("list: central repository (default mode)", () => {
  it("returns empty list when no servers installed", async () => {
    const servers = await listServerDefinitions();
    expect(servers).toEqual([]);
  });

  it("lists installed servers with source and transport", async () => {
    const server: ServerDefinition = {
      name: "test-mcp",
      source: "https://github.com/example/test-mcp",
      default: {
        transport: "stdio",
        command: "npx",
        args: ["-y", "test-mcp"],
        env: {},
      },
      overrides: {},
    };
    await writeServerDefinition(server);

    const servers = await listServerDefinitions();
    expect(servers).toHaveLength(1);
    expect(servers.at(0)?.name).toBe("test-mcp");
    expect(servers.at(0)?.source).toBe("https://github.com/example/test-mcp");
    expect(servers.at(0)?.default.transport).toBe("stdio");
  });

  it("includes override count information", async () => {
    const server: ServerDefinition = {
      name: "override-mcp",
      source: "https://example.com",
      default: {
        transport: "stdio",
        command: "npx",
        args: [],
        env: {},
      },
      overrides: {
        "claude-code": { transport: "http", url: "http://localhost", headers: {} },
      },
    };
    await writeServerDefinition(server);

    const servers = await listServerDefinitions();
    expect(Object.keys(servers.at(0)?.overrides ?? {})).toHaveLength(1);
  });
});

describe("list --deployed: project-level view", () => {
  it("reads servers from adapter configs in project directory", async () => {
    const { claudeCodeAdapter } = await import("../adapters/claude-code.js");
    const projectDir = tmpDir;

    await claudeCodeAdapter.write(projectDir, "brave-search", {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@anthropic/mcp-brave-search"],
      env: { BRAVE_API_KEY: "key" },
    });

    const servers = await claudeCodeAdapter.read(projectDir);
    expect(servers["brave-search"]).toBeTruthy();
  });
});
