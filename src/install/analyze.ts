import type { GitHubRef } from "./source.js";
import { parseClaudeMcpAdd } from "./parse-claude-mcp-add.js";
import { parseJsonBlocks } from "./parse-json-block.js";
import { parsePackageJsonName, parsePyprojectName } from "./manifest-remote.js";
import type { DefaultConfig } from "../types.js";

export interface AnalysisResult {
  readonly name: string;
  readonly default: DefaultConfig;
  readonly overrides: Readonly<Record<string, never>>;
  readonly requiredEnvVars: readonly string[];
}

export interface AnalyzeDeps {
  fetchReadme: (ref: GitHubRef) => Promise<string>;
  fetchManifest: (ref: GitHubRef, name: string) => Promise<string | undefined>;
}

export async function analyzeFromGitHub(
  ref: GitHubRef,
  deps: AnalyzeDeps,
): Promise<AnalysisResult> {
  const readme = await deps.fetchReadme(ref);
  const p1 = parseClaudeMcpAdd(readme);
  const candidates = parseJsonBlocks(readme);
  const p2 = candidates.find((c) => c.source === "mcpServers");
  const p3 = candidates.find((c) => c.source === "bare");

  if (p1) {
    const envKeys = mergeEnvKeys(p1.envKeys, p2?.envKeys ?? []);
    return toResult(p1.name, p1, envKeys);
  }
  if (p2) return toResult(p2.name ?? ref.repo, p2, p2.envKeys);
  if (p3) return toResult(ref.repo, p3, p3.envKeys);

  const pkgRaw = await deps.fetchManifest(ref, "package.json");
  if (pkgRaw) {
    const name = parsePackageJsonName(pkgRaw);
    if (name) {
      return {
        name,
        default: { transport: "stdio", command: "npx", args: ["-y", name], env: {} },
        overrides: {},
        requiredEnvVars: [],
      };
    }
  }
  const pyRaw = await deps.fetchManifest(ref, "pyproject.toml");
  if (pyRaw) {
    const name = parsePyprojectName(pyRaw);
    if (name) {
      return {
        name,
        default: { transport: "stdio", command: "uvx", args: [name], env: {} },
        overrides: {},
        requiredEnvVars: [],
      };
    }
  }
  throw new Error(
    `Rule-based analysis could not extract MCP config from ${ref.owner}/${ref.repo}`,
  );
}

function toResult(
  name: string | undefined,
  cand: {
    transport: "stdio" | "http";
    command?: string;
    args?: readonly string[];
    url?: string;
    headers?: Readonly<Record<string, string>>;
  },
  envKeys: readonly string[],
): AnalysisResult {
  const resolvedName = name ?? "mcp-server";
  if (cand.transport === "stdio") {
    return {
      name: resolvedName,
      default: {
        transport: "stdio",
        command: cand.command ?? "",
        args: [...(cand.args ?? [])],
        env: {},
      },
      overrides: {},
      requiredEnvVars: envKeys,
    };
  }
  return {
    name: resolvedName,
    default: { transport: "http", url: cand.url ?? "", headers: { ...(cand.headers ?? {}) } },
    overrides: {},
    requiredEnvVars: envKeys,
  };
}

function mergeEnvKeys(p1: readonly string[], p2: readonly string[]): string[] {
  const set = new Set<string>(p1);
  for (const k of p2) set.add(k);
  return [...set];
}
