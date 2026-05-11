import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { resolveEnvInArgs } from "./env-args.js";

const GLOBAL_CONFIG_PATH = join(homedir(), ".hermes", "config.yaml");

function toAgentFormat(config: DefaultConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    const { resolvedArgs, remainingEnv } = resolveEnvInArgs(
      config.args,
      config.env,
    );
    const result: Record<string, unknown> = {
      command: config.command,
      args: resolvedArgs,
    };
    if (Object.keys(remainingEnv).length > 0) {
      result["env"] = { ...remainingEnv };
    }
    return result;
  }
  const result: Record<string, unknown> = { url: config.url };
  if (Object.keys(config.headers).length > 0) {
    result["headers"] = { ...config.headers };
  }
  return result;
}

function readEnvField(
  value: unknown,
): Readonly<Record<string, string>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const env: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    env[key] = String(rawValue);
  }
  return env;
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  if (raw["command"]) {
    const command = raw["command"] as string;
    const args = (raw["args"] as string[]) ?? [];
    const env = readEnvField(raw["env"]) ?? {};
    return { transport: "stdio", command, args, env };
  }
  if (raw["url"]) {
    return {
      transport: "http",
      url: raw["url"] as string,
      headers: (raw["headers"] as Record<string, string>) ?? {},
    };
  }
  return undefined;
}

async function readYamlFile(
  filePath: string,
): Promise<Record<string, unknown>> {
  if (!existsSync(filePath)) {
    return {};
  }
  const raw = await readFile(filePath, "utf-8");
  const parsed = parseYaml(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, unknown>;
}

async function writeYamlFile(
  filePath: string,
  data: Record<string, unknown>,
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, stringifyYaml(data), "utf-8");
}

export const hermesAdapter: AgentAdapter = {
  id: "hermes",
  name: "Hermes",
  configPath: () => GLOBAL_CONFIG_PATH,
  isGlobal: true,

  toAgentFormat,
  fromAgentFormat,

  async read() {
    const data = await readYamlFile(GLOBAL_CONFIG_PATH);
    return (data["mcp_servers"] as Record<string, unknown>) ?? {};
  },

  async write(_projectDir, serverName, config) {
    const data = await readYamlFile(GLOBAL_CONFIG_PATH);
    const servers = (data["mcp_servers"] as Record<string, unknown>) ?? {};
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in Hermes config`,
      );
    }
    const updated = {
      ...data,
      mcp_servers: { ...servers, [serverName]: toAgentFormat(config) },
    };
    await writeYamlFile(GLOBAL_CONFIG_PATH, updated);
  },

  async remove(_projectDir, serverName) {
    const data = await readYamlFile(GLOBAL_CONFIG_PATH);
    const servers = (data["mcp_servers"] as Record<string, unknown>) ?? {};
    const { [serverName]: _, ...rest } = servers;
    await writeYamlFile(GLOBAL_CONFIG_PATH, { ...data, mcp_servers: rest });
  },

  async has(_projectDir, serverName) {
    const data = await readYamlFile(GLOBAL_CONFIG_PATH);
    const servers = (data["mcp_servers"] as Record<string, unknown>) ?? {};
    return serverName in servers;
  },
};
