import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ServerDefinition } from "../types.js";
import { resolve } from "../services/source-resolver.js";
import { upsertBundle } from "../utils/bundle-store.js";
import { paths } from "../utils/paths.js";
import { writeServerDefinition } from "../utils/server-store.js";

let originalBaseDir: string;
let originalServersDir: string;
let originalBundlesFile: string;
let originalServerFile: typeof paths.serverFile;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "mcpsmgr-resolver-"));
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

const baseDef: ServerDefinition = {
  name: "cross-agent-teams",
  source: "jtianling/cross-agent-teams-mcp",
  repoName: "cross-agent-teams-mcp",
  bundleId: "git:https://github.com/jtianling/cross-agent-teams-mcp",
  default: { transport: "stdio", command: "npx", args: [], env: {} },
  overrides: {},
};

describe("source resolver", () => {
  it("resolves GitHub URL and owner/repo inputs to an existing bundle", async () => {
    await writeServerDefinition(baseDef);
    await upsertBundle(baseDef.bundleId!, {
      url: "https://github.com/jtianling/cross-agent-teams-mcp",
      members: ["cross-agent-teams", "cross-agent-teams-channel"],
      selectionMode: "all",
    });

    await expect(
      resolve("https://github.com/jtianling/cross-agent-teams-mcp"),
    ).resolves.toMatchObject({
      kind: "bundle",
      members: ["cross-agent-teams", "cross-agent-teams-channel"],
    });
    await expect(resolve("jtianling/cross-agent-teams-mcp")).resolves.toMatchObject({
      kind: "bundle",
      bundleId: baseDef.bundleId,
    });
  });

  it("prefers server name over repoName", async () => {
    await writeServerDefinition(baseDef);
    await writeServerDefinition({ ...baseDef, name: "cross-agent-teams-mcp" });
    await expect(resolve("cross-agent-teams-mcp")).resolves.toEqual({
      kind: "server",
      name: "cross-agent-teams-mcp",
    });
  });

  it("resolves kebab repoName to a bundle", async () => {
    await writeServerDefinition(baseDef);
    await upsertBundle(baseDef.bundleId!, {
      url: "https://github.com/jtianling/cross-agent-teams-mcp",
      members: ["cross-agent-teams"],
      selectionMode: "all",
    });

    await expect(resolve("cross-agent-teams-mcp")).resolves.toMatchObject({
      kind: "bundle",
      members: ["cross-agent-teams"],
    });
  });

  it("returns ambiguous-reponame when repoName matches multiple bundles", async () => {
    await writeServerDefinition(baseDef);
    await writeServerDefinition({
      ...baseDef,
      name: "other-server",
      source: "other/cross-agent-teams-mcp",
      bundleId: "git:https://github.com/other/cross-agent-teams-mcp",
    });

    await expect(resolve("cross-agent-teams-mcp")).resolves.toEqual({
      kind: "not-found",
      inputForm: "ambiguous-reponame",
      candidates: [
        "jtianling/cross-agent-teams-mcp",
        "other/cross-agent-teams-mcp",
      ],
    });
  });

  it("returns not-found forms for unknown inputs", async () => {
    await expect(resolve("missing-server")).resolves.toEqual({
      kind: "not-found",
      inputForm: "kebab",
    });
    await expect(resolve("owner/repo")).resolves.toEqual({
      kind: "not-found",
      inputForm: "owner-repo",
    });
    await expect(resolve("https://gitlab.com/foo/bar")).resolves.toEqual({
      kind: "not-found",
      inputForm: "url",
    });
    await expect(resolve("@scope/pkg")).resolves.toEqual({
      kind: "not-found",
      inputForm: "invalid",
    });
  });
});
