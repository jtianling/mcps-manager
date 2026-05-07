import { describe, it, expect, vi } from "vitest";
import { classifyAddInput, runAdd, type AddDeps } from "../add.js";
import type { Manifest } from "../../install/manifest-schema.js";
import type { ServerDefinition, AgentId, DefaultConfig } from "../../types.js";

function buildDeps(overrides: Partial<AddDeps> = {}): AddDeps {
  const sink: { print: string[]; warn: string[]; error: string[] } = {
    print: [],
    warn: [],
    error: [],
  };
  let exitCode = 0;
  return {
    projectDir: "/tmp/proj",
    serverExists: () => false,
    readServerDefinition: async () => undefined,
    writeServerDefinition: vi.fn(async () => undefined),
    detectAgentIds: () => [],
    fetchManifest: async () => undefined,
    readmeFallbackInstall: async () => undefined,
    promptAgents: async () => [],
    promptManifestAgents: async () => [],
    promptVariableValue: async () => "",
    promptEnvValue: async () => "",
    confirmOverwrite: async () => true,
    writeToAgent: vi.fn(async () => undefined),
    print: (l) => sink.print.push(l),
    warn: (l) => sink.warn.push(l),
    error: (l) => sink.error.push(l),
    setExitCode: (c) => {
      exitCode = c;
    },
    ...overrides,
    // attach diagnostics for assertions
    __sink: sink,
    __exitCode: () => exitCode,
  } as AddDeps & {
    __sink: typeof sink;
    __exitCode: () => number;
  };
}

function getDiagnostics(deps: AddDeps) {
  return deps as unknown as AddDeps & {
    __sink: { print: string[]; warn: string[]; error: string[] };
    __exitCode: () => number;
  };
}

describe("classifyAddInput", () => {
  it("recognizes central kebab-case server name", () => {
    expect(classifyAddInput("context7")).toEqual({
      kind: "central",
      name: "context7",
    });
    expect(classifyAddInput("my-mcp-server")).toEqual({
      kind: "central",
      name: "my-mcp-server",
    });
  });

  it("recognizes owner/repo as github", () => {
    expect(classifyAddInput("jtianling/cross-agent-teams-mcp")).toEqual({
      kind: "github",
      source: "jtianling/cross-agent-teams-mcp",
    });
  });

  it("recognizes https://github.com/owner/repo as github", () => {
    expect(
      classifyAddInput("https://github.com/jtianling/cross-agent-teams-mcp"),
    ).toEqual({
      kind: "github",
      source: "https://github.com/jtianling/cross-agent-teams-mcp",
    });
  });

  it("rejects non-github URL", () => {
    const r = classifyAddInput("https://gitlab.com/foo/bar");
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.reason).toMatch(/Only GitHub URLs/);
    }
  });

  it("rejects empty input", () => {
    const r = classifyAddInput("");
    expect(r.kind).toBe("error");
  });

  it("rejects @scope/pkg style", () => {
    const r = classifyAddInput("@scope/pkg");
    expect(r.kind).toBe("error");
  });

  it("rejects bare unknown words", () => {
    const r = classifyAddInput("Random Words With Spaces");
    expect(r.kind).toBe("error");
  });
});

describe("runAdd central server name flow", () => {
  it("delegates to existing central → project flow", async () => {
    const definition: ServerDefinition = {
      name: "context7",
      source: "test",
      default: { transport: "stdio", command: "npx", args: [], env: {} },
      overrides: {},
    };
    const writeToAgent = vi.fn(async () => undefined);
    const promptAgents = vi.fn(async () => ["claude-code" as AgentId]);
    const deps = buildDeps({
      serverExists: (n) => n === "context7",
      readServerDefinition: async () => definition,
      detectAgentIds: () => [],
      promptAgents,
      writeToAgent,
    });
    await runAdd("context7", {}, deps);
    expect(promptAgents).toHaveBeenCalled();
    expect(writeToAgent).toHaveBeenCalledWith(
      "claude-code",
      "/tmp/proj",
      "context7",
      definition.default,
    );
  });

  it("--port with central name errors out", async () => {
    const deps = buildDeps({ serverExists: () => true });
    await runAdd("context7", { port: "9300" }, deps);
    const d = getDiagnostics(deps);
    expect(d.__sink.error.some((l) => /--port only applies/.test(l))).toBe(true);
    expect(d.__exitCode()).toBe(1);
  });

  it("server not in central errors out", async () => {
    const deps = buildDeps({ serverExists: () => false });
    await runAdd("nonexistent", {}, deps);
    const d = getDiagnostics(deps);
    expect(d.__sink.error.some((l) => /not found in central/.test(l))).toBe(true);
    expect(d.__exitCode()).toBe(1);
  });

  it("-a claude-code skips agent selection prompt", async () => {
    const definition: ServerDefinition = {
      name: "context7",
      source: "test",
      default: { transport: "http", url: "http://x", headers: {} },
      overrides: {},
    };
    const promptAgents = vi.fn();
    const writeToAgent = vi.fn(async () => undefined);
    const deps = buildDeps({
      serverExists: () => true,
      readServerDefinition: async () => definition,
      promptAgents,
      writeToAgent,
    });
    await runAdd("context7", { agent: "claude-code" }, deps);
    expect(promptAgents).not.toHaveBeenCalled();
    expect(writeToAgent).toHaveBeenCalledWith(
      "claude-code",
      "/tmp/proj",
      "context7",
      definition.default,
    );
  });

  it("-a unknown-agent errors out", async () => {
    const deps = buildDeps();
    await runAdd("context7", { agent: "bogus" }, deps);
    const d = getDiagnostics(deps);
    expect(d.__sink.error.some((l) => /unknown agent 'bogus'/.test(l))).toBe(true);
    expect(d.__exitCode()).toBe(1);
  });
});

const xatsManifest: Manifest = {
  schemaVersion: "1.0.0",
  name: "cross-agent-teams",
  variables: { port: { default: "9100" } },
  agents: {
    "claude-code": {
      servers: [
        {
          name: "cross-agent-teams",
          config: {
            transport: "http",
            url: "http://127.0.0.1:${port}/mcp",
          },
        },
        {
          name: "cross-agent-teams-channel",
          config: {
            transport: "stdio",
            command: "npx",
            args: [
              "-y",
              "-p",
              "cross-agent-teams-mcp@^0.5",
              "cross-agent-teams-channel",
              "--daemon-url",
              "http://127.0.0.1:${port}/mcp",
            ],
          },
        },
      ],
      postInstallNotes: [
        "Launch with --dangerously-load-development-channels server:cross-agent-teams-channel",
      ],
    },
    codex: {
      servers: [
        {
          name: "cross-agent-teams",
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
      description: "Start the daemon",
      command: "npx -y cross-agent-teams-mcp@^0.5 daemon --port ${port}",
    },
  ],
  envVars: [
    {
      name: "CROSS_AGENT_TEAMS_TOKEN",
      required: false,
      secret: true,
      appliedAs: {
        kind: "header",
        name: "Authorization",
        format: "Bearer ${VALUE}",
      },
    },
  ],
  compatibility: { npmPackage: "cross-agent-teams-mcp@^0.5" },
};

describe("runAdd github manifest flow", () => {
  it("with -a claude-code writes both servers + central + project, prints prereq + notes", async () => {
    const writes: { name: string; transport: string }[] = [];
    const writeToAgent = vi.fn(
      async (
        _id: AgentId,
        _dir: string,
        name: string,
        cfg: DefaultConfig,
      ) => {
        writes.push({ name, transport: cfg.transport });
      },
    );
    const writeServerDefinition = vi.fn(async () => undefined);
    const deps = buildDeps({
      fetchManifest: async () => xatsManifest,
      writeToAgent,
      writeServerDefinition,
      promptEnvValue: async () => "",
    });
    await runAdd(
      "jtianling/cross-agent-teams-mcp",
      { agent: "claude-code" },
      deps,
    );
    expect(writeServerDefinition).toHaveBeenCalledTimes(2);
    expect(writes.map((w) => w.name).sort()).toEqual([
      "cross-agent-teams",
      "cross-agent-teams-channel",
    ]);
    expect(
      writes.find((w) => w.name === "cross-agent-teams-channel")?.transport,
    ).toBe("stdio");
    const d = getDiagnostics(deps);
    expect(
      d.__sink.print.some((l) =>
        /npx -y cross-agent-teams-mcp.* daemon --port 9100/.test(l),
      ),
    ).toBe(true);
    expect(
      d.__sink.print.some((l) =>
        /--dangerously-load-development-channels/.test(l),
      ),
    ).toBe(true);
  });

  it("with no -a, prompts for agents", async () => {
    const promptManifestAgents = vi.fn(async () => ["codex" as AgentId]);
    const writeToAgent = vi.fn(async () => undefined);
    const deps = buildDeps({
      fetchManifest: async () => xatsManifest,
      promptManifestAgents,
      writeToAgent,
    });
    await runAdd("jtianling/cross-agent-teams-mcp", {}, deps);
    expect(promptManifestAgents).toHaveBeenCalledWith(
      ["claude-code", "codex"],
      expect.any(Set),
    );
    expect(writeToAgent).toHaveBeenCalledWith(
      "codex",
      "/tmp/proj",
      "cross-agent-teams",
      expect.objectContaining({ transport: "http" }),
    );
  });

  it("-a antigravity (not in manifest) errors with available list", async () => {
    const deps = buildDeps({ fetchManifest: async () => xatsManifest });
    await runAdd(
      "jtianling/cross-agent-teams-mcp",
      { agent: "antigravity" },
      deps,
    );
    const d = getDiagnostics(deps);
    expect(
      d.__sink.error.some(
        (l) =>
          /manifest does not declare configuration for agent 'antigravity'/.test(l) &&
          /available: claude-code, codex/.test(l),
      ),
    ).toBe(true);
    expect(d.__exitCode()).toBe(1);
  });

  it("--port 9300 substitutes ${port} in resolved url", async () => {
    const writes: DefaultConfig[] = [];
    const writeToAgent = vi.fn(
      async (_a, _b, _name, cfg: DefaultConfig) => {
        writes.push(cfg);
      },
    );
    const deps = buildDeps({
      fetchManifest: async () => xatsManifest,
      writeToAgent,
    });
    await runAdd(
      "jtianling/cross-agent-teams-mcp",
      { agent: "codex", port: "9300" },
      deps,
    );
    expect(writes).toHaveLength(1);
    if (writes[0]!.transport === "http") {
      expect(writes[0]!.url).toBe("http://127.0.0.1:9300/mcp");
    } else {
      throw new Error("expected http config");
    }
  });

  it("--port without manifest variables.port errors", async () => {
    const m: Manifest = { ...xatsManifest, variables: {} };
    const deps = buildDeps({ fetchManifest: async () => m });
    await runAdd(
      "jtianling/cross-agent-teams-mcp",
      { agent: "claude-code", port: "9300" },
      deps,
    );
    const d = getDiagnostics(deps);
    expect(
      d.__sink.error.some((l) =>
        /--port has no effect.*variables.port/.test(l),
      ),
    ).toBe(true);
    expect(d.__exitCode()).toBe(1);
  });

  it("envVar CROSS_AGENT_TEAMS_TOKEN prompted, header injected", async () => {
    let captured: DefaultConfig | undefined;
    const deps = buildDeps({
      fetchManifest: async () => xatsManifest,
      promptEnvValue: async (ev) =>
        ev.name === "CROSS_AGENT_TEAMS_TOKEN" ? "abc-token" : "",
      writeToAgent: async (_id, _dir, _name, cfg) => {
        if (cfg.transport === "http") captured = cfg;
      },
    });
    await runAdd(
      "jtianling/cross-agent-teams-mcp",
      { agent: "codex" },
      deps,
    );
    expect(captured).toBeDefined();
    if (captured && captured.transport === "http") {
      expect(captured.headers["Authorization"]).toBe("Bearer abc-token");
    }
  });
});

describe("runAdd github fallback to README", () => {
  it("manifest 404 → readme fallback installs and deploys", async () => {
    const fetchManifest = vi.fn(async () => undefined);
    const readmeFallback = vi.fn(async () => "extracted-server");
    const writeToAgent = vi.fn(async () => undefined);
    const deps = buildDeps({
      fetchManifest,
      readmeFallbackInstall: readmeFallback,
      serverExists: (n) => n === "extracted-server",
      readServerDefinition: async () => ({
        name: "extracted-server",
        source: "owner/repo",
        default: { transport: "stdio", command: "npx", args: [], env: {} },
        overrides: {},
      }),
      promptAgents: async () => ["claude-code"],
      writeToAgent,
    });
    await runAdd("owner/repo", {}, deps);
    expect(fetchManifest).toHaveBeenCalled();
    expect(readmeFallback).toHaveBeenCalledWith("owner/repo");
    expect(writeToAgent).toHaveBeenCalledWith(
      "claude-code",
      "/tmp/proj",
      "extracted-server",
      expect.objectContaining({ transport: "stdio" }),
    );
    const d = getDiagnostics(deps);
    expect(
      d.__sink.print.some((l) =>
        /No mcpsmgr.json found.*falling back to README analysis/.test(l),
      ),
    ).toBe(true);
  });

  it("manifest 404 + readme fallback returns undefined → no deploy", async () => {
    const writeToAgent = vi.fn(async () => undefined);
    const deps = buildDeps({
      fetchManifest: async () => undefined,
      readmeFallbackInstall: async () => undefined,
      writeToAgent,
    });
    await runAdd("owner/repo", {}, deps);
    expect(writeToAgent).not.toHaveBeenCalled();
  });
});
