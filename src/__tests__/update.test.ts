import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ServerDefinition, StdioConfig } from "../types.js";
import {
  writeServerDefinition,
  listServerDefinitions,
} from "../utils/server-store.js";
import { paths } from "../utils/paths.js";

let originalBaseDir: string;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-update-"));
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

describe("update: env value preservation", () => {
  it("preserves existing env values when keys match", () => {
    const oldConfig: StdioConfig = {
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: { API_KEY: "user-secret-123", DEBUG: "true" },
    };

    const newConfig: StdioConfig = {
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg@2.0"],
      env: { API_KEY: "", NEW_VAR: "" },
    };

    const mergedEnv: Record<string, string> = { ...newConfig.env };
    for (const [key, value] of Object.entries(oldConfig.env)) {
      if (key in mergedEnv) {
        mergedEnv[key] = value;
      }
    }

    expect(mergedEnv.API_KEY).toBe("user-secret-123");
    expect(mergedEnv.NEW_VAR).toBe("");
    expect(mergedEnv.DEBUG).toBeUndefined();
  });
});

describe("update: source filtering", () => {
  it("identifies servers with remote sources for update", async () => {
    const remoteServer: ServerDefinition = {
      name: "remote-server",
      source: "https://github.com/example/mcp",
      default: {
        transport: "stdio",
        command: "npx",
        args: ["-y", "remote-pkg"],
        env: {},
      },
      overrides: {},
    };

    const localServer: ServerDefinition = {
      name: "local-server",
      source: "local",
      default: {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: {},
      },
      overrides: {},
    };

    const noSourceServer: ServerDefinition = {
      name: "no-source",
      source: "",
      default: {
        transport: "stdio",
        command: "npx",
        args: [],
        env: {},
      },
      overrides: {},
    };

    await writeServerDefinition(remoteServer);
    await writeServerDefinition(localServer);
    await writeServerDefinition(noSourceServer);

    const all = await listServerDefinitions();
    const updatable = all.filter(
      (s) => s.source && s.source !== "local",
    );

    expect(updatable).toHaveLength(1);
    expect(updatable.at(0)?.name).toBe("remote-server");
  });
});

describe("update: change detection", () => {
  it("detects config changes", () => {
    const oldDef = JSON.stringify({
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: {},
    });

    const newDef = JSON.stringify({
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg@2.0"],
      env: {},
    });

    expect(oldDef !== newDef).toBe(true);
  });

  it("detects no changes when configs are identical", () => {
    const config = {
      transport: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: {},
    };

    expect(JSON.stringify(config)).toBe(JSON.stringify({ ...config }));
  });
});
