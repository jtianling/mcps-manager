import { describe, expect, it, vi } from "vitest";
import type { ServerDefinition } from "../../types.js";
import { runUninstall, type UninstallDeps } from "../uninstall.js";

function buildDeps(overrides: Partial<UninstallDeps> = {}): UninstallDeps {
  let exitCode = 0;
  return {
    serverExists: () => true,
    readServerDefinition: async () => undefined,
    removeServerDefinition: vi.fn(async () => true),
    removeMember: vi.fn(async () => undefined),
    print: vi.fn(),
    error: vi.fn(),
    setExitCode: (code) => {
      exitCode = code;
    },
    ...overrides,
    __exitCode: () => exitCode,
  } as UninstallDeps & { __exitCode: () => number };
}

function diagnostics(deps: UninstallDeps) {
  return deps as UninstallDeps & { __exitCode: () => number };
}

const bundledServer: ServerDefinition = {
  name: "cross-agent-teams",
  source: "owner/repo",
  repoName: "repo",
  bundleId: "git:https://github.com/owner/repo",
  default: { transport: "stdio", command: "npx", args: [], env: {} },
  overrides: {},
};

describe("runUninstall", () => {
  it("removes a bundled server member", async () => {
    const removeMember = vi.fn(async () => undefined);
    const deps = buildDeps({
      readServerDefinition: async () => bundledServer,
      removeMember,
    });

    await runUninstall("cross-agent-teams", deps);

    expect(deps.removeServerDefinition).toHaveBeenCalledWith("cross-agent-teams");
    expect(removeMember).toHaveBeenCalledWith(
      "git:https://github.com/owner/repo",
      "cross-agent-teams",
    );
  });

  it("does not touch bundles for old servers without bundleId", async () => {
    const removeMember = vi.fn(async () => undefined);
    const deps = buildDeps({
      readServerDefinition: async () => ({
        ...bundledServer,
        bundleId: undefined,
        repoName: undefined,
      }),
      removeMember,
    });

    await runUninstall("legacy", deps);

    expect(removeMember).not.toHaveBeenCalled();
  });

  it("errors when the server does not exist", async () => {
    const removeMember = vi.fn(async () => undefined);
    const deps = buildDeps({
      serverExists: () => false,
      removeMember,
    });

    await runUninstall("missing", deps);

    expect(deps.removeServerDefinition).not.toHaveBeenCalled();
    expect(removeMember).not.toHaveBeenCalled();
    expect(diagnostics(deps).__exitCode()).toBe(1);
  });
});
