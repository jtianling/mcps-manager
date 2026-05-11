import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readBundle,
  readBundles,
  removeMember,
  upsertBundle,
} from "../utils/bundle-store.js";
import { paths } from "../utils/paths.js";

let originalBaseDir: string;
let originalServersDir: string;
let originalBundlesFile: string;
let originalServerFile: typeof paths.serverFile;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-bundles-"));
  originalBaseDir = paths.baseDir;
  originalServersDir = paths.serversDir;
  originalBundlesFile = paths.bundlesFile;
  originalServerFile = paths.serverFile;
  Object.assign(paths, {
    baseDir: tmpDir,
    serversDir: join(tmpDir, "servers"),
    bundlesFile: join(tmpDir, "bundles.json"),
    serverFile: (name: string) => join(tmpDir, "servers", `${name}.json`),
  });
});

afterEach(async () => {
  Object.assign(paths, {
    baseDir: originalBaseDir,
    serversDir: originalServersDir,
    bundlesFile: originalBundlesFile,
    serverFile: originalServerFile,
  });
  await rm(tmpDir, { recursive: true, force: true });
});

describe("bundle-store", () => {
  it("returns an empty collection when bundles.json is missing", async () => {
    await expect(readBundles()).resolves.toEqual({
      version: "1",
      bundles: {},
    });
  });

  it("creates, reads, updates, and chmods bundles.json", async () => {
    await upsertBundle("git:https://github.com/a/repo", {
      url: "https://github.com/a/repo",
      members: ["a", "b"],
      selectionMode: "all",
    });
    await upsertBundle("git:https://github.com/a/repo", {
      url: "https://github.com/a/repo",
      members: ["b"],
      selectionMode: "all",
    });

    const bundle = await readBundle("git:https://github.com/a/repo");
    expect(bundle?.members).toEqual(["b"]);
    expect(bundle?.installedAt).toBeDefined();
    expect(bundle?.updatedAt).toBeDefined();

    const mode = (await stat(paths.bundlesFile)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("removes a member and drops the bundle after the last member", async () => {
    const id = "git:https://github.com/a/repo";
    await upsertBundle(id, {
      url: "https://github.com/a/repo",
      members: ["a", "b"],
      selectionMode: "all",
    });

    await removeMember(id, "a");
    expect((await readBundle(id))?.members).toEqual(["b"]);

    await removeMember(id, "b");
    expect(await readBundle(id)).toBeUndefined();
    const raw = JSON.parse(await readFile(paths.bundlesFile, "utf-8"));
    expect(raw.bundles).toEqual({});
  });

  it("throws when bundles.json is corrupted", async () => {
    await writeFile(paths.bundlesFile, "{ nope", "utf-8");
    await expect(readBundles()).rejects.toThrow(/Failed to parse bundles\.json/);
  });
});
