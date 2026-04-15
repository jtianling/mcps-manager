import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectProjectFromDir } from "../local-dir.js";

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "local-dir-"));
});
afterEach(async () => {
  await rm(tmp, { recursive: true });
});

describe("detectProjectFromDir", () => {
  it("detects Node.js via package.json", async () => {
    await writeFile(join(tmp, "package.json"), JSON.stringify({ name: "my-pkg" }));
    const out = await detectProjectFromDir(tmp);
    expect(out).toEqual({
      name: "my-pkg",
      type: "node",
      command: "npx",
      args: ["-y", tmp],
    });
  });

  it("detects Python via pyproject.toml", async () => {
    await writeFile(join(tmp, "pyproject.toml"), '[project]\nname = "py-mcp"\n');
    const out = await detectProjectFromDir(tmp);
    expect(out).toEqual({
      name: "py-mcp",
      type: "python",
      command: "uvx",
      args: ["--from", tmp, "py-mcp"],
    });
  });

  it("returns undefined when no manifest found", async () => {
    await mkdir(join(tmp, "empty"), { recursive: true });
    const out = await detectProjectFromDir(join(tmp, "empty"));
    expect(out).toBeUndefined();
  });
});
