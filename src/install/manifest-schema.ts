import type { AgentId } from "../types.js";

export type ManifestTransport = "stdio" | "http" | "streamable-http" | "sse";

export interface ManifestVariable {
  readonly default: string;
  readonly prompt?: string;
  readonly required?: boolean;
}

export interface ManifestEnvVarAppliedAs {
  readonly kind: "header";
  readonly name: string;
  readonly format: string;
}

export interface ManifestEnvVar {
  readonly name: string;
  readonly required?: boolean;
  readonly secret?: boolean;
  readonly description?: string;
  readonly appliedAs?: ManifestEnvVarAppliedAs;
}

export interface ManifestPrerequisite {
  readonly kind: "long-running-command" | "command";
  readonly description?: string;
  readonly command: string;
  readonly notes?: readonly string[];
}

export interface ManifestStdioServerConfig {
  readonly transport: "stdio";
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

export interface ManifestHttpServerConfig {
  readonly transport: "http" | "streamable-http" | "sse";
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export type ManifestServerConfig =
  | ManifestStdioServerConfig
  | ManifestHttpServerConfig;

export interface ManifestServer {
  readonly name: string;
  readonly config: ManifestServerConfig;
}

export interface ManifestAgent {
  readonly servers: readonly ManifestServer[];
  readonly postInstallNotes?: readonly string[];
}

export interface ManifestCompatibility {
  readonly npmPackage?: string;
}

export interface Manifest {
  readonly $schema?: string;
  readonly schemaVersion: string;
  readonly name: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly compatibility?: ManifestCompatibility;
  readonly variables?: Readonly<Record<string, ManifestVariable>>;
  readonly envVars?: readonly ManifestEnvVar[];
  readonly prerequisites?: readonly ManifestPrerequisite[];
  readonly agents: Readonly<Partial<Record<AgentId, ManifestAgent>>>;
}

export type ValidationResult =
  | { readonly ok: true; readonly manifest: Manifest }
  | { readonly ok: false; readonly errors: readonly string[] };

const KNOWN_AGENT_IDS: readonly AgentId[] = [
  "claude-code",
  "codex",
  "cursor",
  "gemini-cli",
  "opencode",
  "antigravity",
  "openclaw",
  "hermes",
];

const VALID_TRANSPORTS: readonly ManifestTransport[] = [
  "stdio",
  "http",
  "streamable-http",
  "sse",
];

export function validateManifest(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["manifest must be a JSON object"] };
  }
  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  validateRequiredFields(obj, errors);
  if (errors.length > 0) return { ok: false, errors };

  validateAgents(obj["agents"] as Record<string, unknown>, errors);
  validateEnvVars(obj["envVars"], errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: obj as unknown as Manifest };
}

function validateRequiredFields(
  obj: Record<string, unknown>,
  errors: string[],
): void {
  if (obj["schemaVersion"] === undefined) {
    errors.push("manifest missing required field: schemaVersion");
  } else if (typeof obj["schemaVersion"] !== "string") {
    errors.push("schemaVersion must be a string");
  } else if (!String(obj["schemaVersion"]).startsWith("1.")) {
    errors.push(
      `unsupported schemaVersion '${obj["schemaVersion"]}'; mcpsmgr only supports 1.x manifests; please upgrade mcpsmgr or pin to a 1.x manifest`,
    );
  }

  if (obj["name"] === undefined) {
    errors.push("manifest missing required field: name");
  } else if (typeof obj["name"] !== "string" || obj["name"] === "") {
    errors.push("name must be a non-empty string");
  }

  const agents = obj["agents"];
  if (agents === undefined) {
    errors.push("manifest missing required field: agents");
    return;
  }
  if (typeof agents !== "object" || agents === null || Array.isArray(agents)) {
    errors.push("agents must be an object");
    return;
  }
  if (Object.keys(agents as object).length === 0) {
    errors.push("manifest must declare at least one agent under 'agents'");
  }
}

function validateAgents(
  agents: Record<string, unknown>,
  errors: string[],
): void {
  for (const [id, agentRaw] of Object.entries(agents)) {
    if (!KNOWN_AGENT_IDS.includes(id as AgentId)) {
      errors.push(
        `unknown agent id '${id}' in manifest.agents; known: ${KNOWN_AGENT_IDS.join(", ")}`,
      );
      continue;
    }
    if (!agentRaw || typeof agentRaw !== "object" || Array.isArray(agentRaw)) {
      errors.push(`agents.${id} must be an object`);
      continue;
    }
    const agentObj = agentRaw as Record<string, unknown>;
    const servers = agentObj["servers"];
    if (!Array.isArray(servers)) {
      errors.push(`agents.${id}.servers must be an array`);
      continue;
    }
    servers.forEach((s, i) => validateServerEntry(id, i, s, errors));
  }
}

function validateServerEntry(
  agentId: string,
  index: number,
  raw: unknown,
  errors: string[],
): void {
  const path = `agents.${agentId}.servers[${index}]`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const srv = raw as Record<string, unknown>;
  if (typeof srv["name"] !== "string" || srv["name"] === "") {
    errors.push(`${path} missing 'name'`);
  }
  const cfg = srv["config"];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    errors.push(`${path}.config missing or not an object`);
    return;
  }
  const cfgObj = cfg as Record<string, unknown>;
  const transport = cfgObj["transport"];
  if (typeof transport !== "string" || transport === "") {
    errors.push(`${path}.config.transport missing`);
    return;
  }
  if (!VALID_TRANSPORTS.includes(transport as ManifestTransport)) {
    errors.push(
      `unsupported transport '${transport}' in ${path}; expected stdio | http | streamable-http | sse`,
    );
    return;
  }
  if (transport === "stdio") {
    if (typeof cfgObj["command"] !== "string" || cfgObj["command"] === "") {
      errors.push(`${path}.config.command must be a non-empty string for stdio`);
    }
  } else if (typeof cfgObj["url"] !== "string" || cfgObj["url"] === "") {
    errors.push(`${path}.config.url must be a non-empty string for ${transport}`);
  }
}

function validateEnvVars(rawEnvVars: unknown, errors: string[]): void {
  if (rawEnvVars === undefined) return;
  if (!Array.isArray(rawEnvVars)) {
    errors.push("envVars must be an array");
    return;
  }
  rawEnvVars.forEach((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`envVars[${i}] must be an object`);
      return;
    }
    const ev = entry as Record<string, unknown>;
    const name = ev["name"];
    if (typeof name !== "string" || name === "") {
      errors.push(`envVars[${i}] missing 'name'`);
      return;
    }
    const aa = ev["appliedAs"];
    if (aa === undefined) return;
    if (!aa || typeof aa !== "object" || Array.isArray(aa)) {
      errors.push(`envVars[${i}].appliedAs must be an object`);
      return;
    }
    const aaObj = aa as Record<string, unknown>;
    if (aaObj["kind"] !== "header") {
      errors.push(`envVars[${i}].appliedAs.kind must be 'header'`);
    }
    if (typeof aaObj["name"] !== "string" || aaObj["name"] === "") {
      errors.push(`envVars[${i}].appliedAs.name must be a non-empty string`);
    }
    const format = aaObj["format"];
    if (typeof format !== "string" || format === "") {
      errors.push(`envVars[${i}].appliedAs.format must be a non-empty string`);
    } else if (!format.includes("${VALUE}")) {
      errors.push(
        `envVar '${name}'.appliedAs.format must contain \${VALUE} placeholder`,
      );
    }
  });
}
