import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installFromLocal } from "../install.js";

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "install-local-"));
});
afterEach(async () => {
  await rm(tmp, { recursive: true });
});

describe("installFromLocal", () => {
  it("writes from single-server JSON file", async () => {
    const path = join(tmp, "mcp.json");
    await writeFile(
      path,
      JSON.stringify({
        mcpServers: { foo: { command: "npx", args: ["-y", "foo"] } },
      }),
    );
    const write = vi.fn();
    await installFromLocal(path, {
      writeServerDefinition: write,
      serverExists: () => false,
      selectServers: async (defs) => [...defs],
      askEnvValue: async () => "",
      confirm: async () => true,
      fallbackToManual: async () => {},
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ name: "foo", source: "local" }),
    );
  });

  it("prompts for selection on multi-server JSON", async () => {
    const path = join(tmp, "multi.json");
    await writeFile(
      path,
      JSON.stringify({
        mcpServers: { a: { command: "x", args: [] }, b: { command: "y", args: [] } },
      }),
    );
    const selectServers = vi.fn().mockImplementation(async (defs) => [defs[0]]);
    const write = vi.fn();
    await installFromLocal(path, {
      writeServerDefinition: write,
      serverExists: () => false,
      selectServers,
      askEnvValue: async () => "",
      confirm: async () => true,
      fallbackToManual: async () => {},
    });
    expect(selectServers).toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("surfaces error when JSON invalid", async () => {
    const path = join(tmp, "bad.json");
    await writeFile(path, "{ not json");
    await expect(
      installFromLocal(path, {
        writeServerDefinition: vi.fn(),
        serverExists: () => false,
        selectServers: async (defs) => [...defs],
        askEnvValue: async () => "",
        confirm: async () => true,
        fallbackToManual: async () => {},
      }),
    ).rejects.toThrow(/JSON/);
  });

  it("detects Node.js project from directory", async () => {
    await writeFile(join(tmp, "package.json"), JSON.stringify({ name: "dir-pkg" }));
    const write = vi.fn();
    await installFromLocal(tmp, {
      writeServerDefinition: write,
      serverExists: () => false,
      selectServers: async (defs) => [...defs],
      askEnvValue: async () => "",
      confirm: async () => true,
      fallbackToManual: async () => {},
    });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ name: "dir-pkg", source: "local" }),
    );
  });
});
