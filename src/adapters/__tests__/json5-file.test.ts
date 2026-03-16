import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readJson5File, writeJson5File } from "../json5-file.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-json5-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

describe("readJson5File", () => {
  it("returns empty object for non-existent file", async () => {
    const result = await readJson5File(join(tmpDir, "missing.json"));
    expect(result).toEqual({});
  });

  it("parses standard JSON", async () => {
    const filePath = join(tmpDir, "config.json");
    await writeFile(filePath, '{"key": "value"}', "utf-8");
    const result = await readJson5File(filePath);
    expect(result).toEqual({ key: "value" });
  });

  it("parses JSON5 with single-line comments", async () => {
    const filePath = join(tmpDir, "config.json");
    await writeFile(
      filePath,
      '{\n  // this is a comment\n  "key": "value"\n}',
      "utf-8",
    );
    const result = await readJson5File(filePath);
    expect(result).toEqual({ key: "value" });
  });

  it("parses JSON5 with block comments and trailing commas", async () => {
    const filePath = join(tmpDir, "config.json");
    await writeFile(
      filePath,
      '{\n  /* block comment */\n  "a": 1,\n  "b": 2,\n}',
      "utf-8",
    );
    const result = await readJson5File(filePath);
    expect(result).toEqual({ a: 1, b: 2 });
  });
});

describe("writeJson5File", () => {
  it("writes JSON with 2-space indent and trailing newline", async () => {
    const filePath = join(tmpDir, "out.json");
    await writeJson5File(filePath, { key: "value" });
    const raw = await readFile(filePath, "utf-8");
    expect(raw).toBe('{\n  "key": "value"\n}\n');
  });

  it("creates parent directories if missing", async () => {
    const filePath = join(tmpDir, "nested", "deep", "out.json");
    await writeJson5File(filePath, { ok: true });
    const raw = await readFile(filePath, "utf-8");
    expect(JSON.parse(raw)).toEqual({ ok: true });
  });
});
