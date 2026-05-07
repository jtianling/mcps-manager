import { checkbox, password, input } from "@inquirer/prompts";
import { allAdapters, detectAgents, getAdapter } from "../adapters/index.js";
import {
  readServerDefinition,
  serverExists,
  writeServerDefinition,
} from "../utils/server-store.js";
import { resolveConfig } from "../utils/resolve-config.js";
import { CHECKBOX_DEFAULTS, isUserCancellation } from "../utils/prompt.js";
import type {
  AgentAdapter,
  AgentId,
  DefaultConfig,
  ServerDefinition,
} from "../types.js";
import {
  parseGitHubSource,
  isGitHubRepo,
  type GitHubRef,
} from "../install/source.js";
import {
  fetchManifest as defaultFetchManifest,
} from "../install/manifest-fetch.js";
import {
  applyManifest,
  collectVariableDefaults,
} from "../install/manifest-apply.js";
import type {
  Manifest,
  ManifestEnvVar,
  ManifestVariable,
} from "../install/manifest-schema.js";
import {
  installFromRemote,
  productionRemoteDeps,
} from "./install.js";

const KEBAB_CASE = /^[a-z][a-z0-9-]*$/;
const KNOWN_AGENT_IDS: readonly AgentId[] = allAdapters.map((a) => a.id);

export type AddInput =
  | { readonly kind: "central"; readonly name: string }
  | { readonly kind: "github"; readonly source: string }
  | { readonly kind: "error"; readonly reason: string };

export function classifyAddInput(rawInput: string): AddInput {
  const trimmed = rawInput.trim();
  if (trimmed === "") {
    return { kind: "error", reason: "Server input is required." };
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (parseGitHubSource(trimmed)) {
      return { kind: "github", source: trimmed };
    }
    return {
      kind: "error",
      reason:
        "Only GitHub URLs are supported for remote add. Use './path.json' for other sources or pass a central server name.",
    };
  }
  if (isGitHubRepo(trimmed)) {
    return { kind: "github", source: trimmed };
  }
  if (KEBAB_CASE.test(trimmed)) {
    return { kind: "central", name: trimmed };
  }
  return {
    kind: "error",
    reason:
      "Invalid input. Provide a GitHub URL (https://github.com/owner/repo), owner/repo shortname, or a central server name (kebab-case).",
  };
}

export interface AddOptions {
  readonly agent?: string;
  readonly port?: string;
}

export interface AddDeps {
  readonly projectDir: string;
  readonly serverExists: (name: string) => boolean;
  readonly readServerDefinition: (
    name: string,
  ) => Promise<ServerDefinition | undefined>;
  readonly writeServerDefinition: (def: ServerDefinition) => Promise<void>;
  readonly detectAgentIds: (projectDir: string) => readonly AgentId[];
  readonly fetchManifest: (ref: GitHubRef) => Promise<Manifest | undefined>;
  readonly readmeFallbackInstall: (source: string) => Promise<string | undefined>;
  readonly promptAgents: (
    message: string,
    detected: ReadonlySet<AgentId>,
  ) => Promise<readonly AgentId[]>;
  readonly promptManifestAgents: (
    available: readonly AgentId[],
    detected: ReadonlySet<AgentId>,
  ) => Promise<readonly AgentId[]>;
  readonly promptVariableValue: (
    name: string,
    def: ManifestVariable,
  ) => Promise<string>;
  readonly promptEnvValue: (ev: ManifestEnvVar) => Promise<string>;
  readonly confirmOverwrite: (name: string) => Promise<boolean>;
  readonly writeToAgent: (
    agentId: AgentId,
    projectDir: string,
    serverName: string,
    config: DefaultConfig,
  ) => Promise<void>;
  readonly print: (line: string) => void;
  readonly warn: (line: string) => void;
  readonly error: (line: string) => void;
  readonly setExitCode: (code: number) => void;
}

export async function addCommand(
  serverInput: string,
  options: AddOptions = {},
): Promise<void> {
  try {
    await runAdd(serverInput, options, productionAddDeps());
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

export async function runAdd(
  serverInput: string,
  options: AddOptions,
  deps: AddDeps,
): Promise<void> {
  const classified = classifyAddInput(serverInput);
  if (classified.kind === "error") {
    deps.error(`Error: ${classified.reason}`);
    deps.setExitCode(1);
    return;
  }

  if (
    options.agent !== undefined &&
    !KNOWN_AGENT_IDS.includes(options.agent as AgentId)
  ) {
    deps.error(
      `Error: unknown agent '${options.agent}'. Known: ${KNOWN_AGENT_IDS.join(", ")}`,
    );
    deps.setExitCode(1);
    return;
  }

  if (classified.kind === "central") {
    if (options.port !== undefined) {
      deps.error(
        "Error: --port only applies to manifest-driven add (GitHub source)",
      );
      deps.setExitCode(1);
      return;
    }
    await runAddFromCentral(classified.name, options.agent as AgentId | undefined, deps);
    return;
  }

  await runAddFromGitHub(classified.source, options, deps);
}

async function runAddFromCentral(
  serverName: string,
  agentFlag: AgentId | undefined,
  deps: AddDeps,
): Promise<void> {
  if (!deps.serverExists(serverName)) {
    deps.error(
      `Error: Server "${serverName}" not found in central repository. Use "mcpsmgr install" to add it.`,
    );
    deps.setExitCode(1);
    return;
  }
  const definition = await deps.readServerDefinition(serverName);
  if (!definition) {
    deps.error(`Error: Failed to read server definition for "${serverName}".`);
    deps.setExitCode(1);
    return;
  }
  const detectedIds = new Set(deps.detectAgentIds(deps.projectDir));
  const selectedAgentIds = agentFlag
    ? [agentFlag]
    : await deps.promptAgents(
        `Select agents to add "${serverName}" to:`,
        detectedIds,
      );
  if (selectedAgentIds.length === 0) {
    deps.print("No agents selected.");
    return;
  }

  for (const id of selectedAgentIds) {
    const adapter = getAdapter(id);
    try {
      const config = resolveConfig(definition, adapter);
      await deps.writeToAgent(id, deps.projectDir, serverName, config);
      deps.print(`  + ${serverName} -> ${adapter.name}`);
    } catch (error) {
      deps.warn(
        `  ! ${serverName} -> ${adapter.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function runAddFromGitHub(
  source: string,
  options: AddOptions,
  deps: AddDeps,
): Promise<void> {
  const ref = parseGitHubSource(source);
  if (!ref) {
    deps.error("Error: invalid GitHub source");
    deps.setExitCode(1);
    return;
  }

  const manifest = await deps.fetchManifest(ref);

  if (!manifest) {
    deps.print(
      `No mcpsmgr.json found in ${ref.owner}/${ref.repo}, falling back to README analysis...`,
    );
    if (options.port !== undefined) {
      deps.warn(
        "Warning: --port is ignored in README fallback (manifest absent)",
      );
    }
    const installedName = await deps.readmeFallbackInstall(source);
    if (!installedName) return;
    await runAddFromCentral(
      installedName,
      options.agent as AgentId | undefined,
      deps,
    );
    return;
  }

  await runAddFromManifest(source, manifest, options, deps);
}

async function runAddFromManifest(
  source: string,
  manifest: Manifest,
  options: AddOptions,
  deps: AddDeps,
): Promise<void> {
  const declaredAgentIds = Object.keys(manifest.agents) as AgentId[];

  if (options.port !== undefined && !manifest.variables?.["port"]) {
    deps.error(
      "Error: --port has no effect: manifest does not declare 'variables.port'",
    );
    deps.setExitCode(1);
    return;
  }

  const detectedIds = new Set(deps.detectAgentIds(deps.projectDir));
  let selectedAgentIds: readonly AgentId[];
  if (options.agent !== undefined) {
    const id = options.agent as AgentId;
    if (!declaredAgentIds.includes(id)) {
      deps.error(
        `Error: manifest does not declare configuration for agent '${id}'; available: ${declaredAgentIds.join(", ")}`,
      );
      deps.setExitCode(1);
      return;
    }
    selectedAgentIds = [id];
  } else {
    selectedAgentIds = await deps.promptManifestAgents(
      declaredAgentIds,
      detectedIds,
    );
  }

  if (selectedAgentIds.length === 0) {
    deps.print("No agents selected.");
    return;
  }

  const variableValues: Record<string, string> = {
    ...collectVariableDefaults(manifest),
  };
  if (options.port !== undefined) variableValues["port"] = options.port;
  for (const [name, def] of Object.entries(manifest.variables ?? {})) {
    if (name === "port" && options.port !== undefined) continue;
    if (def.required === true && variableValues[name] === undefined) {
      variableValues[name] = await deps.promptVariableValue(name, def);
    }
  }

  const envValues: Record<string, string> = {};
  for (const ev of manifest.envVars ?? []) {
    if (ev.required === true) {
      envValues[ev.name] = await deps.promptEnvValue(ev);
    } else {
      const value = await deps.promptEnvValue(ev);
      if (value !== "") envValues[ev.name] = value;
    }
  }

  let result: ReturnType<typeof applyManifest>;
  try {
    result = applyManifest({
      manifest,
      source,
      variableValues,
      envValues,
      agentIds: selectedAgentIds,
    });
  } catch (e) {
    deps.error(
      `Error: ${e instanceof Error ? e.message : String(e)}`,
    );
    deps.setExitCode(1);
    return;
  }

  for (const w of result.warnings) deps.warn(`Warning: ${w}`);

  for (const id of selectedAgentIds) {
    const adapter = getAdapter(id);
    const defs = result.perAgent[id] ?? [];
    for (const def of defs) {
      if (deps.serverExists(def.name)) {
        const ok = await deps.confirmOverwrite(def.name);
        if (!ok) {
          deps.print(`  · skipped (central): ${def.name}`);
          continue;
        }
      }
      await deps.writeServerDefinition(def);
      deps.print(`  + ${def.name} -> central repository`);
      try {
        await deps.writeToAgent(id, deps.projectDir, def.name, def.default);
        deps.print(`  + ${def.name} -> ${adapter.name}`);
      } catch (error) {
        deps.warn(
          `  ! ${def.name} -> ${adapter.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  if (result.prerequisites.length > 0) {
    deps.print("");
    deps.print("Prerequisites (mcpsmgr will NOT run these for you):");
    for (const p of result.prerequisites) {
      if (p.description) deps.print(`  - ${p.description}`);
      deps.print(`      $ ${p.command}`);
      for (const note of p.notes) deps.print(`      • ${note}`);
    }
  }

  for (const id of selectedAgentIds) {
    const notes = result.postInstallNotes[id];
    if (!notes || notes.length === 0) continue;
    deps.print("");
    deps.print(`Post-install notes (${getAdapter(id).name}):`);
    for (const note of notes) deps.print(`  • ${note}`);
  }
}

function productionAddDeps(): AddDeps {
  return {
    projectDir: process.cwd(),
    serverExists,
    readServerDefinition,
    writeServerDefinition,
    detectAgentIds: (projectDir) =>
      detectAgents(projectDir).map((a) => a.id),
    fetchManifest: (ref) => defaultFetchManifest(ref),
    readmeFallbackInstall: (source) =>
      installFromRemote(source, productionRemoteDeps()),
    promptAgents: (message, detectedIds) =>
      promptAgentsCheckbox(message, detectedIds),
    promptManifestAgents: (available, detectedIds) =>
      promptManifestAgentsCheckbox(available, detectedIds),
    promptVariableValue: (name, def) =>
      input({
        message: def.prompt ?? `Enter value for ${name}:`,
        default: def.default,
      }),
    promptEnvValue: (ev) =>
      ev.secret
        ? password({
            message:
              ev.description ??
              `Enter value for ${ev.name} (stored locally, never sent to servers):`,
            mask: "*",
          })
        : input({
            message: ev.description ?? `Enter value for ${ev.name}:`,
          }),
    confirmOverwrite: async (name) => {
      const { confirm } = await import("@inquirer/prompts");
      return confirm({
        message: `Server "${name}" already exists in central repository. Overwrite?`,
      });
    },
    writeToAgent: async (id, projectDir, serverName, config) => {
      const adapter = getAdapter(id);
      await adapter.write(projectDir, serverName, config);
    },
    print: (line) => console.log(line),
    warn: (line) => console.warn(line),
    error: (line) => console.error(line),
    setExitCode: (code) => {
      process.exitCode = code;
    },
  };
}

async function promptAgentsCheckbox(
  message: string,
  detectedIds: ReadonlySet<AgentId>,
): Promise<readonly AgentId[]> {
  const selected = await checkbox<AgentAdapter>({
    message,
    choices: allAdapters.map((adapter) => ({
      name: `${adapter.name}${detectedIds.has(adapter.id) ? " (detected)" : ""}${adapter.isGlobal ? " [global]" : ""}`,
      value: adapter,
      checked: detectedIds.has(adapter.id) && !adapter.isGlobal,
    })),
    ...CHECKBOX_DEFAULTS,
  });
  return selected.map((a) => a.id);
}

async function promptManifestAgentsCheckbox(
  available: readonly AgentId[],
  detectedIds: ReadonlySet<AgentId>,
): Promise<readonly AgentId[]> {
  const candidates = allAdapters.filter((a) => available.includes(a.id));
  const selected = await checkbox<AgentAdapter>({
    message: "Select agents to configure for this manifest:",
    choices: candidates.map((adapter) => ({
      name: `${adapter.name}${detectedIds.has(adapter.id) ? " (detected)" : ""}${adapter.isGlobal ? " [global]" : ""}`,
      value: adapter,
      checked: detectedIds.has(adapter.id) && !adapter.isGlobal,
    })),
    ...CHECKBOX_DEFAULTS,
  });
  return selected.map((a) => a.id);
}
