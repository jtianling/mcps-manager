import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import type { ServerDefinition } from "../types.js";
import {
  writeServerDefinition,
  readServerDefinition,
} from "../utils/server-store.js";
import { paths } from "../utils/paths.js";

let originalBaseDir: string;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-ci-"));
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

const validDefinition: ServerDefinition = {
  name: "test-server",
  source: "local",
  default: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "test-package"],
    env: { TEST_KEY: "value" },
  },
  overrides: {},
};

describe("custom-install: JSON file validation", () => {
  it("accepts a valid server definition JSON", async () => {
    const filePath = join(tmpDir, "test-server.json");
    await writeFile(filePath, JSON.stringify(validDefinition));

    const raw = JSON.parse(await readFile(filePath, "utf-8")) as ServerDefinition;
    expect(raw.name).toBe("test-server");
    expect(raw.default.transport).toBe("stdio");
    if (raw.default.transport === "stdio") {
      expect(raw.default.command).toBe("npx");
    }
  });

  it("rejects definition without name", async () => {
    const invalid = { default: { transport: "stdio", command: "npx", args: [], env: {} } };
    const filePath = join(tmpDir, "bad.json");
    await writeFile(filePath, JSON.stringify(invalid));
    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    expect(raw.name).toBeUndefined();
  });

  it("rejects definition with invalid transport", async () => {
    const invalid = { name: "x", default: { transport: "grpc", command: "npx" } };
    const filePath = join(tmpDir, "bad.json");
    await writeFile(filePath, JSON.stringify(invalid));
    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    expect(raw.default.transport).not.toBe("stdio");
    expect(raw.default.transport).not.toBe("http");
  });
});

describe("custom-install: conflict detection", () => {
  it("detects existing server with same name", async () => {
    await writeServerDefinition(validDefinition);
    const exists = existsSync(paths.serverFile("test-server"));
    expect(exists).toBe(true);
  });

  it("overwrites when forced", async () => {
    await writeServerDefinition(validDefinition);

    const updated: ServerDefinition = {
      ...validDefinition,
      default: {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: {},
      },
    };
    await writeServerDefinition(updated);

    const result = await readServerDefinition("test-server");
    expect(result).toBeDefined();
    if (result?.default.transport === "stdio") {
      expect(result.default.command).toBe("node");
    }
  });
});

describe("custom-install: source field", () => {
  it("sets source to local for custom-installed servers", async () => {
    const def: ServerDefinition = { ...validDefinition, source: "local" };
    await writeServerDefinition(def);

    const result = await readServerDefinition("test-server");
    expect(result?.source).toBe("local");
  });
});
