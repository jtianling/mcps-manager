import { describe, it, expect, vi } from "vitest";
import { analyzeFromGitHub } from "../analyze.js";

const deps = {
  fetchReadme: vi.fn(),
  fetchManifest: vi.fn(),
};

function reset() {
  deps.fetchReadme.mockReset();
  deps.fetchManifest.mockReset();
}

describe("analyzeFromGitHub", () => {
  it("prefers P1 (claude mcp add) and merges env keys from P2", async () => {
    reset();
    deps.fetchReadme.mockResolvedValue(
      [
        "```sh",
        "claude mcp add blender uvx blender-mcp",
        "```",
        "```json",
        '{"mcpServers": {"blender": {"command": "uvx", "args": ["blender-mcp"], "env": {"BLENDER_HOST": "x"}}}}',
        "```",
      ].join("\n"),
    );
    const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
    expect(result.name).toBe("blender");
    expect(result.default.transport).toBe("stdio");
    if (result.default.transport === "stdio") {
      expect(result.default.command).toBe("uvx");
      expect(result.default.args).toEqual(["blender-mcp"]);
    }
    expect(result.requiredEnvVars).toEqual(["BLENDER_HOST"]);
  });

  it("P1 name wins when P1 and P2 disagree", async () => {
    reset();
    deps.fetchReadme.mockResolvedValue(
      [
        "```sh",
        "claude mcp add name-from-p1 uvx pkg",
        "```",
        "```json",
        '{"mcpServers": {"different-name": {"command": "uvx", "args": ["pkg"]}}}',
        "```",
      ].join("\n"),
    );
    const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
    expect(result.name).toBe("name-from-p1");
  });

  it("falls back to P2 when P1 absent", async () => {
    reset();
    deps.fetchReadme.mockResolvedValue(
      '```json\n{"mcpServers": {"figma": {"command": "npx", "args": ["-y", "figma-mcp"]}}}\n```',
    );
    const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
    expect(result.name).toBe("figma");
  });

  it("falls back to manifest when P1-P3 all absent", async () => {
    reset();
    deps.fetchReadme.mockResolvedValue("# just prose, no code blocks");
    deps.fetchManifest.mockImplementation(async (_ref: unknown, name: string) => {
      if (name === "package.json") return JSON.stringify({ name: "repo-pkg" });
      return undefined;
    });
    const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
    expect(result.name).toBe("repo-pkg");
    if (result.default.transport === "stdio") {
      expect(result.default.command).toBe("npx");
      expect(result.default.args).toEqual(["-y", "repo-pkg"]);
    }
  });

  it("uses pyproject.toml name when package.json absent", async () => {
    reset();
    deps.fetchReadme.mockResolvedValue("no code blocks");
    deps.fetchManifest.mockImplementation(async (_ref: unknown, name: string) => {
      if (name === "pyproject.toml") return '[project]\nname = "py-mcp"\n';
      return undefined;
    });
    const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
    expect(result.name).toBe("py-mcp");
    if (result.default.transport === "stdio") {
      expect(result.default.command).toBe("uvx");
      expect(result.default.args).toEqual(["py-mcp"]);
    }
  });

  it("throws when everything fails", async () => {
    reset();
    deps.fetchReadme.mockResolvedValue("no blocks here");
    deps.fetchManifest.mockResolvedValue(undefined);
    await expect(analyzeFromGitHub({ owner: "a", repo: "b" }, deps)).rejects.toThrow(
      /could not extract/i,
    );
  });
});
