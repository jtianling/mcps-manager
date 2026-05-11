import type {
  AgentId,
  DefaultConfig,
  HttpConfig,
  ServerDefinition,
  StdioConfig,
} from "../types.js";
import type {
  Manifest,
  ManifestPrerequisite,
  ManifestServerConfig,
} from "./manifest-schema.js";
import { gitBundleMetadata } from "../utils/url-normalize.js";

const VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export interface ApplyManifestInput {
  readonly manifest: Manifest;
  readonly source: string;
  readonly variableValues: Readonly<Record<string, string>>;
  readonly envValues: Readonly<Record<string, string>>;
  readonly agentIds: readonly AgentId[];
}

export interface ResolvedPrerequisite {
  readonly kind: ManifestPrerequisite["kind"];
  readonly description?: string;
  readonly command: string;
  readonly notes: readonly string[];
}

export interface ApplyManifestResult {
  readonly perAgent: Readonly<
    Partial<Record<AgentId, readonly ServerDefinition[]>>
  >;
  readonly warnings: readonly string[];
  readonly prerequisites: readonly ResolvedPrerequisite[];
  readonly postInstallNotes: Readonly<
    Partial<Record<AgentId, readonly string[]>>
  >;
}

export function applyManifest(input: ApplyManifestInput): ApplyManifestResult {
  const { manifest, source, variableValues, envValues, agentIds } = input;
  const subs: Record<string, string> = {
    ...variableValues,
    ...envValues,
  };
  const optionalDeclared = collectOptionalDeclaredNames(manifest, envValues);
  const sourceMetadata = gitBundleMetadata(source);

  validateSelectedAgents(manifest, agentIds);
  const headerInsertions = buildEnvHeaderInsertions(manifest, envValues);
  const warnings = computeCompatibilityWarnings(manifest);

  const perAgent: Partial<Record<AgentId, readonly ServerDefinition[]>> = {};
  const postInstallNotes: Partial<Record<AgentId, readonly string[]>> = {};

  for (const id of agentIds) {
    const agent = manifest.agents[id]!;
    const defs: ServerDefinition[] = agent.servers.map((srv, i) => {
      const path = `agents.${id}.servers[${i}]`;
      const resolved = resolveServerConfig(
        srv.config,
        subs,
        optionalDeclared,
        path,
        headerInsertions,
      );
      return {
        name: srv.name,
        source,
        ...(sourceMetadata
          ? {
              repoName: sourceMetadata.repoName,
              bundleId: sourceMetadata.bundleId,
            }
          : {}),
        default: resolved,
        overrides: {},
      };
    });
    perAgent[id] = defs;

    if (agent.postInstallNotes && agent.postInstallNotes.length > 0) {
      postInstallNotes[id] = agent.postInstallNotes.map((n, i) =>
        substitute(
          n,
          subs,
          optionalDeclared,
          `agents.${id}.postInstallNotes[${i}]`,
        ),
      );
    }
  }

  const prerequisites = (manifest.prerequisites ?? []).map((p, i) => ({
    kind: p.kind,
    description: p.description,
    command: substitute(
      p.command,
      subs,
      optionalDeclared,
      `prerequisites[${i}].command`,
    ),
    notes: (p.notes ?? []).map((n, j) =>
      substitute(
        n,
        subs,
        optionalDeclared,
        `prerequisites[${i}].notes[${j}]`,
      ),
    ),
  }));

  return { perAgent, warnings, prerequisites, postInstallNotes };
}

function collectOptionalDeclaredNames(
  manifest: Manifest,
  envValues: Readonly<Record<string, string>>,
): ReadonlySet<string> {
  const set = new Set<string>();
  for (const ev of manifest.envVars ?? []) {
    if (ev.required === true) continue;
    if (envValues[ev.name] !== undefined && envValues[ev.name] !== "") continue;
    set.add(ev.name);
  }
  for (const [name, def] of Object.entries(manifest.variables ?? {})) {
    if (def.required === true) continue;
    if (envValues[name] !== undefined) continue;
    set.add(name);
  }
  return set;
}

function validateSelectedAgents(
  manifest: Manifest,
  agentIds: readonly AgentId[],
): void {
  const declared = Object.keys(manifest.agents);
  for (const id of agentIds) {
    if (!manifest.agents[id]) {
      throw new Error(
        `manifest does not declare configuration for agent '${id}'; available: ${declared.join(", ")}`,
      );
    }
  }
}

function buildEnvHeaderInsertions(
  manifest: Manifest,
  envValues: Readonly<Record<string, string>>,
): readonly { readonly header: string; readonly value: string }[] {
  const out: { header: string; value: string }[] = [];
  for (const ev of manifest.envVars ?? []) {
    const aa = ev.appliedAs;
    if (!aa || aa.kind !== "header") continue;
    const value = envValues[ev.name];
    if (value === undefined || value === "") continue;
    const headerValue = aa.format.replace(/\$\{VALUE\}/g, value);
    out.push({ header: aa.name, value: headerValue });
  }
  return out;
}

function computeCompatibilityWarnings(manifest: Manifest): readonly string[] {
  const compat = manifest.compatibility?.npmPackage;
  if (!compat) return [];
  const match = /^(@?[a-z0-9._-]+(?:\/[a-z0-9._-]+)?)@(.+)$/i.exec(compat);
  if (!match) return [];
  const pkgName = match[1]!;
  const expectedRange = match[2]!;
  const argRangeRe = new RegExp(`^${escapeRegExp(pkgName)}@(.+)$`);
  const warnings: string[] = [];
  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    if (!agent) continue;
    for (let i = 0; i < agent.servers.length; i++) {
      const cfg = agent.servers[i]!.config;
      if (cfg.transport !== "stdio") continue;
      for (const arg of cfg.args ?? []) {
        const m = argRangeRe.exec(arg);
        if (m && m[1] !== expectedRange) {
          warnings.push(
            `agents.${agentId}.servers[${i}] arg '${arg}' references '${pkgName}@${m[1]}' but compatibility.npmPackage declares '${pkgName}@${expectedRange}'`,
          );
        }
      }
    }
  }
  return warnings;
}

function resolveServerConfig(
  cfg: ManifestServerConfig,
  subs: Readonly<Record<string, string>>,
  optionalDeclared: ReadonlySet<string>,
  path: string,
  headerInsertions: readonly { readonly header: string; readonly value: string }[],
): DefaultConfig {
  if (cfg.transport === "stdio") {
    const command = substitute(
      cfg.command,
      subs,
      optionalDeclared,
      `${path}.config.command`,
    );
    const args = (cfg.args ?? []).map((a, i) =>
      substitute(a, subs, optionalDeclared, `${path}.config.args[${i}]`),
    );
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg.env ?? {})) {
      env[k] = substitute(
        v,
        subs,
        optionalDeclared,
        `${path}.config.env.${k}`,
      );
    }
    return { transport: "stdio", command, args, env } satisfies StdioConfig;
  }
  const url = substitute(cfg.url, subs, optionalDeclared, `${path}.config.url`);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.headers ?? {})) {
    headers[k] = substitute(
      v,
      subs,
      optionalDeclared,
      `${path}.config.headers.${k}`,
    );
  }
  for (const ins of headerInsertions) {
    if (!(ins.header in headers)) {
      headers[ins.header] = ins.value;
    }
  }
  return { transport: "http", url, headers } satisfies HttpConfig;
}

function substitute(
  s: string,
  subs: Readonly<Record<string, string>>,
  optionalDeclared: ReadonlySet<string>,
  fieldPath: string,
): string {
  return s.replace(VAR_PATTERN, (match, name: string) => {
    const value = subs[name];
    if (value !== undefined) return value;
    if (optionalDeclared.has(name)) return match;
    throw new Error(
      `unresolved variable reference '\${${name}}' in ${fieldPath}`,
    );
  });
}

export function collectVariableDefaults(
  manifest: Manifest,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(manifest.variables ?? {})) {
    out[name] = def.default;
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
