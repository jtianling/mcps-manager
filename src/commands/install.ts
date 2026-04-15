import { resolve } from "node:path";
import { confirm, input, password } from "@inquirer/prompts";
import { checkbox } from "@inquirer/prompts";
import { stat } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { DefaultConfig, ServerDefinition, StdioConfig } from "../types.js";
import {
  serverExists,
  writeServerDefinition,
} from "../utils/server-store.js";
import {
  analyzeFromGitHub,
  type AnalysisResult,
} from "../install/analyze.js";
import { sniffLocalJson } from "../install/local-json.js";
import { detectProjectFromDir } from "../install/local-dir.js";
import { fetchGitHubReadme } from "../install/github-readme.js";
import { fetchManifestDefault } from "../install/manifest-remote.js";
import { parseGitHubSource, isGitHubRepo } from "../install/source.js";
import { selectServers } from "../install/select-servers.js";
import { isUserCancellation } from "../utils/prompt.js";

export type ClassifiedInput =
  | { kind: "github"; value: string }
  | { kind: "local"; value: string }
  | { kind: "error"; reason: string };

const LOCAL_PREFIXES = ["/", "./", "../", "~/", "~"];

export function classifyInput(rawInput: string): ClassifiedInput {
  const trimmed = rawInput.trim();
  if (LOCAL_PREFIXES.some((p) => trimmed.startsWith(p))) {
    return { kind: "local", value: trimmed };
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (parseGitHubSource(trimmed)) return { kind: "github", value: trimmed };
    return {
      kind: "error",
      reason:
        "Only GitHub URLs are supported for remote install. Use ./path.json for other sources.",
    };
  }
  if (isGitHubRepo(trimmed)) return { kind: "github", value: trimmed };
  return {
    kind: "error",
    reason:
      'Invalid input. Provide a GitHub URL (https://github.com/owner/repo), owner/repo shortname, or a local path (./file.json | ./dir).',
  };
}

export interface InstallFromRemoteDeps {
  analyze: (input: string) => Promise<AnalysisResult>;
  confirm: (message: string) => Promise<boolean>;
  askEnvValue: (key: string) => Promise<string>;
  serverExists: (name: string) => boolean;
  writeServerDefinition: (def: ServerDefinition) => Promise<void>;
  fallbackToManual: () => Promise<void>;
}

export async function installFromRemote(
  rawInput: string,
  deps: InstallFromRemoteDeps,
): Promise<void> {
  let analysis: AnalysisResult;
  try {
    analysis = await deps.analyze(rawInput);
  } catch {
    const go = await deps.confirm(
      `Rule-based analysis could not extract MCP config from ${rawInput}. Configure manually instead?`,
    );
    if (go) await deps.fallbackToManual();
    return;
  }
  const trusted = await deps.confirm(`Trust this analysis result?`);
  if (!trusted) {
    const go = await deps.confirm("Configure manually instead?");
    if (go) await deps.fallbackToManual();
    return;
  }
  if (deps.serverExists(analysis.name)) {
    const overwrite = await deps.confirm(
      `Server "${analysis.name}" already exists. Overwrite?`,
    );
    if (!overwrite) return;
  }
  const env: Record<string, string> = {};
  for (const k of analysis.requiredEnvVars) env[k] = await deps.askEnvValue(k);
  const base = analysis.default;
  const merged: DefaultConfig =
    base.transport === "stdio"
      ? ({ ...base, env: { ...base.env, ...env } } satisfies StdioConfig)
      : base;
  const def: ServerDefinition = {
    name: analysis.name,
    source: rawInput,
    default: merged,
    overrides: {},
  };
  await deps.writeServerDefinition(def);
  console.log(`Server "${def.name}" saved to central repository.`);
}

export interface InstallFromLocalDeps {
  writeServerDefinition: (def: ServerDefinition) => Promise<void>;
  serverExists: (name: string) => boolean;
  selectServers: (defs: readonly ServerDefinition[]) => Promise<readonly ServerDefinition[]>;
  askEnvValue: (key: string) => Promise<string>;
  confirm: (message: string) => Promise<boolean>;
  fallbackToManual: () => Promise<void>;
}

export async function installFromLocal(
  path: string,
  deps: InstallFromLocalDeps,
): Promise<void> {
  const info = await stat(path);
  if (info.isFile() && path.endsWith(".json")) {
    const raw = await readFile(path, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`File is not valid JSON: ${path}`);
    }
    const defs = sniffLocalJson(parsed);
    const chosen = await deps.selectServers(defs);
    for (const d of chosen) await writeOneLocal(d, deps);
    return;
  }
  if (info.isDirectory()) {
    const detected = await detectProjectFromDir(path);
    if (!detected) throw new Error(`Cannot detect project type in ${path}`);
    const def: ServerDefinition = {
      name: detected.name,
      source: "local",
      default: {
        transport: "stdio",
        command: detected.command,
        args: [...detected.args],
        env: {},
      } satisfies StdioConfig,
      overrides: {},
    };
    await writeOneLocal(def, deps);
    return;
  }
  throw new Error(`Unsupported local path: ${path}`);
}

async function writeOneLocal(def: ServerDefinition, deps: InstallFromLocalDeps): Promise<void> {
  if (deps.serverExists(def.name)) {
    const overwrite = await deps.confirm(`Server "${def.name}" already exists. Overwrite?`);
    if (!overwrite) return;
  }
  await deps.writeServerDefinition(def);
  console.log(`Server "${def.name}" installed to central repository.`);
}

export async function installCommand(
  source?: string,
  _options: { force?: boolean } = {},
): Promise<void> {
  try {
    await installCommandInner(source);
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function installCommandInner(source?: string): Promise<void> {
  const rawInput =
    source ??
    (await input({
      message: "Enter MCP server URL, GitHub owner/repo, or local path (leave empty for manual):",
    }));

  if (rawInput.trim() === "") {
    await manualAddFlow();
    return;
  }

  const classified = classifyInput(rawInput);
  switch (classified.kind) {
    case "github":
      await installFromRemote(classified.value, productionRemoteDeps());
      return;
    case "local": {
      const resolved = resolve(classified.value);
      if (!existsSync(resolved)) {
        console.error(`Error: Path does not exist: ${resolved}`);
        process.exitCode = 1;
        return;
      }
      await installFromLocal(resolved, productionLocalDeps());
      return;
    }
    case "error":
      console.error(`Error: ${classified.reason}`);
      process.exitCode = 1;
      return;
  }
}

function productionRemoteDeps(): InstallFromRemoteDeps {
  return {
    analyze: async (rawInput) => {
      const ref = parseGitHubSource(rawInput)!;
      console.log(`Fetching README from ${ref.owner}/${ref.repo}...`);
      return analyzeFromGitHub(ref, {
        fetchReadme: (r) => fetchGitHubReadme(r),
        fetchManifest: (r, name) => fetchManifestDefault(r, name),
      });
    },
    confirm: (message) => confirm({ message }),
    askEnvValue: (key) =>
      password({
        message: `Enter value for ${key} (stored locally, never sent to servers):`,
        mask: "*",
      }),
    serverExists,
    writeServerDefinition,
    fallbackToManual: manualAddFlow,
  };
}

function productionLocalDeps(): InstallFromLocalDeps {
  return {
    writeServerDefinition,
    serverExists,
    selectServers: (defs) => selectServers(defs, { checkbox }),
    askEnvValue: (key) =>
      password({
        message: `Enter value for ${key} (stored locally, never sent to servers):`,
        mask: "*",
      }),
    confirm: (message) => confirm({ message }),
    fallbackToManual: manualAddFlow,
  };
}

export async function manualAddFlow(): Promise<void> {
  const name = await input({
    message: "Server name (kebab-case):",
    validate: (v) =>
      /^[a-z][a-z0-9-]*$/.test(v.trim()) ? true : "Must be kebab-case",
  });

  if (serverExists(name.trim())) {
    console.error(
      `Error: Server "${name.trim()}" already exists. Run "mcpsmgr uninstall ${name.trim()}" first.`,
    );
    process.exitCode = 1;
    return;
  }

  const source = await input({
    message: "Source URL (optional):",
  });

  const command = await input({
    message: "Command (e.g., npx):",
    validate: (v) => (v.trim().length > 0 ? true : "Command is required"),
  });

  const argsStr = await input({
    message: "Args (comma-separated, e.g., -y,@scope/package):",
  });
  const args = argsStr
    .trim()
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  const envPairs: Record<string, string> = {};
  while (true) {
    const envName = await input({
      message: "Env var name (leave empty to finish):",
    });
    if (envName.trim() === "") break;
    const envValue = await password({
      message: `Value for ${envName.trim()} (stored locally, never sent to servers):`,
      mask: "*",
    });
    envPairs[envName.trim()] = envValue;
  }

  const config: StdioConfig = {
    transport: "stdio",
    command: command.trim(),
    args,
    env: envPairs,
  };

  const definition: ServerDefinition = {
    name: name.trim(),
    source: source.trim(),
    default: config,
    overrides: {},
  };

  await writeServerDefinition(definition);
  console.log(`Server "${name.trim()}" saved to central repository.`);
}
