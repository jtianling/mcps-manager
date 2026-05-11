import { describe, it, expect } from "vitest";
import { applyManifest, collectVariableDefaults } from "../manifest-apply.js";
import type { Manifest } from "../manifest-schema.js";

const baseManifest: Manifest = {
  schemaVersion: "1.0.0",
  name: "demo",
  variables: { port: { default: "9100" } },
  agents: {
    "claude-code": {
      servers: [
        {
          name: "demo",
          config: {
            transport: "http",
            url: "http://127.0.0.1:${port}/mcp",
          },
        },
        {
          name: "demo-channel",
          config: {
            transport: "stdio",
            command: "npx",
            args: [
              "-y",
              "-p",
              "demo@^0.5",
              "demo-channel",
              "--daemon-url",
              "http://127.0.0.1:${port}/mcp",
            ],
          },
        },
      ],
      postInstallNotes: ["start with --port ${port}"],
    },
    codex: {
      servers: [
        {
          name: "demo",
          config: {
            transport: "streamable-http",
            url: "http://127.0.0.1:${port}/mcp",
          },
        },
      ],
    },
  },
  prerequisites: [
    {
      kind: "long-running-command",
      description: "start daemon",
      command: "demo daemon --port ${port}",
      notes: ["run with token via --token ${TOKEN}"],
    },
  ],
  envVars: [
    {
      name: "TOKEN",
      required: false,
      appliedAs: {
        kind: "header",
        name: "Authorization",
        format: "Bearer ${VALUE}",
      },
    },
  ],
  compatibility: { npmPackage: "demo@^0.5" },
};

describe("applyManifest variable substitution", () => {
  it("adds GitHub repo metadata to each ServerDefinition", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: collectVariableDefaults(baseManifest),
      envValues: {},
      agentIds: ["claude-code"],
    });
    expect(out.perAgent["claude-code"]![0]).toMatchObject({
      source: "owner/repo",
      repoName: "repo",
      bundleId: "git:https://github.com/owner/repo",
    });
  });

  it("uses variable defaults when no override", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: collectVariableDefaults(baseManifest),
      envValues: {},
      agentIds: ["claude-code"],
    });
    const claudeServers = out.perAgent["claude-code"]!;
    const httpDef = claudeServers.find((s) => s.name === "demo")!.default;
    expect(httpDef).toMatchObject({
      transport: "http",
      url: "http://127.0.0.1:9100/mcp",
    });
  });

  it("respects user variable override", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: { port: "9300" },
      envValues: {},
      agentIds: ["claude-code"],
    });
    const httpDef = out.perAgent["claude-code"]!.find(
      (s) => s.name === "demo",
    )!.default;
    expect(httpDef).toMatchObject({ url: "http://127.0.0.1:9300/mcp" });
    const stdioDef = out.perAgent["claude-code"]!.find(
      (s) => s.name === "demo-channel",
    )!.default;
    expect(stdioDef).toMatchObject({ transport: "stdio" });
    if (stdioDef.transport === "stdio") {
      expect(stdioDef.args).toContain("http://127.0.0.1:9300/mcp");
    }
  });

  it("substitutes envVar names cross-field", () => {
    const m: Manifest = {
      ...baseManifest,
      agents: {
        codex: {
          servers: [
            {
              name: "demo",
              config: {
                transport: "http",
                url: "http://127.0.0.1:${port}/mcp",
                headers: { "X-Custom": "raw-${TOKEN}" },
              },
            },
          ],
        },
      },
    };
    const out = applyManifest({
      manifest: m,
      source: "owner/repo",
      variableValues: { port: "9100" },
      envValues: { TOKEN: "abc" },
      agentIds: ["codex"],
    });
    const cfg = out.perAgent.codex![0]!.default;
    expect(cfg.transport).toBe("http");
    if (cfg.transport === "http") {
      expect(cfg.headers["X-Custom"]).toBe("raw-abc");
    }
  });

  it("self-references ${VALUE} in appliedAs.format and injects header", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: { port: "9100" },
      envValues: { TOKEN: "abc123" },
      agentIds: ["claude-code"],
    });
    const httpDef = out.perAgent["claude-code"]!.find(
      (s) => s.name === "demo",
    )!.default;
    if (httpDef.transport !== "http") throw new Error("expected http");
    expect(httpDef.headers["Authorization"]).toBe("Bearer abc123");
  });

  it("does not inject header when envVar value missing", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: { port: "9100" },
      envValues: {},
      agentIds: ["claude-code"],
    });
    const httpDef = out.perAgent["claude-code"]!.find(
      (s) => s.name === "demo",
    )!.default;
    if (httpDef.transport !== "http") throw new Error("expected http");
    expect(httpDef.headers["Authorization"]).toBeUndefined();
  });

  it("throws on unresolved variable reference", () => {
    const m: Manifest = {
      ...baseManifest,
      variables: {},
      agents: {
        "claude-code": {
          servers: [
            {
              name: "demo",
              config: {
                transport: "http",
                url: "http://127.0.0.1:${unknownVar}/mcp",
              },
            },
          ],
        },
      },
    };
    expect(() =>
      applyManifest({
        manifest: m,
        source: "owner/repo",
        variableValues: {},
        envValues: {},
        agentIds: ["claude-code"],
      }),
    ).toThrow(/unresolved variable reference '\$\{unknownVar\}'/);
  });
});

describe("applyManifest prerequisites and notes", () => {
  it("substitutes variables in prerequisite command and notes", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: { port: "9300" },
      envValues: { TOKEN: "abc" },
      agentIds: ["claude-code"],
    });
    expect(out.prerequisites).toHaveLength(1);
    expect(out.prerequisites[0]!.command).toBe("demo daemon --port 9300");
    expect(out.prerequisites[0]!.notes[0]).toBe("run with token via --token abc");
  });

  it("substitutes variables in postInstallNotes", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: { port: "9300" },
      envValues: {},
      agentIds: ["claude-code"],
    });
    expect(out.postInstallNotes["claude-code"]).toEqual(["start with --port 9300"]);
  });
});

describe("applyManifest compatibility.npmPackage", () => {
  it("emits no warning when args match range", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "owner/repo",
      variableValues: { port: "9100" },
      envValues: {},
      agentIds: ["claude-code"],
    });
    expect(out.warnings).toEqual([]);
  });

  it("emits warning when args reference different range", () => {
    const m: Manifest = {
      ...baseManifest,
      compatibility: { npmPackage: "demo@^0.5" },
      agents: {
        "claude-code": {
          servers: [
            {
              name: "demo-channel",
              config: {
                transport: "stdio",
                command: "npx",
                args: ["-y", "-p", "demo@latest", "demo-channel"],
              },
            },
          ],
        },
      },
    };
    const out = applyManifest({
      manifest: m,
      source: "owner/repo",
      variableValues: {},
      envValues: {},
      agentIds: ["claude-code"],
    });
    expect(out.warnings.length).toBeGreaterThan(0);
    expect(out.warnings[0]).toMatch(/demo@latest.*demo@\^0\.5/);
  });
});

describe("applyManifest agent selection guard", () => {
  it("throws when selecting an agent not declared in manifest", () => {
    expect(() =>
      applyManifest({
        manifest: baseManifest,
        source: "owner/repo",
        variableValues: { port: "9100" },
        envValues: {},
        agentIds: ["antigravity"],
      }),
    ).toThrow(
      /manifest does not declare configuration for agent 'antigravity'/,
    );
  });
});

describe("applyManifest perAgent ServerDefinition shape", () => {
  it("preserves source and produces overrides:{}", () => {
    const out = applyManifest({
      manifest: baseManifest,
      source: "https://github.com/owner/repo",
      variableValues: { port: "9100" },
      envValues: {},
      agentIds: ["claude-code"],
    });
    const defs = out.perAgent["claude-code"]!;
    expect(defs).toHaveLength(2);
    for (const def of defs) {
      expect(def.source).toBe("https://github.com/owner/repo");
      expect(def.overrides).toEqual({});
    }
  });
});
