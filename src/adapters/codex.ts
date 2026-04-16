import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { buildEnvArgs, parseEnvArgs, resolveEnvInArgs } from "./env-args.js";

function toAgentFormat(config: DefaultConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    const { resolvedArgs, remainingEnv } = resolveEnvInArgs(
      config.args,
      config.env,
    );
    const envArgs = buildEnvArgs(remainingEnv);
    if (envArgs.length > 0) {
      return {
        command: "env",
        args: [...envArgs, config.command, ...resolvedArgs],
      };
    }
    return {
      command: config.command,
      args: resolvedArgs,
    };
  }
  return {
    url: config.url,
    http_headers: { ...config.headers },
  };
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  if (raw["command"]) {
    const command = raw["command"] as string;
    const rawArgs = (raw["args"] as string[]) ?? [];
    const legacyEnv = raw["env"] as Record<string, string> | undefined;

    if (legacyEnv && Object.keys(legacyEnv).length > 0) {
      return { transport: "stdio", command, args: rawArgs, env: legacyEnv };
    }

    if (command === "env") {
      const { env, commandIndex } = parseEnvArgs(rawArgs);
      return {
        transport: "stdio",
        command: rawArgs[commandIndex] ?? "",
        args: rawArgs.slice(commandIndex + 1),
        env,
      };
    }

    return { transport: "stdio", command, args: rawArgs, env: {} };
  }
  if (raw["url"]) {
    return {
      transport: "http",
      url: raw["url"] as string,
      headers: (raw["http_headers"] as Record<string, string>) ?? {},
    };
  }
  return undefined;
}

async function readTomlFile(
  filePath: string,
): Promise<{ raw: string; parsed: Record<string, unknown> }> {
  if (!existsSync(filePath)) {
    return { raw: "", parsed: {} };
  }
  const raw = await readFile(filePath, "utf-8");
  const parsed = parseToml(raw) as Record<string, unknown>;
  return { raw, parsed };
}

async function writeTomlFile(
  filePath: string,
  data: Record<string, unknown>,
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, stringifyToml(data) + "\n", "utf-8");
}

export const codexAdapter: AgentAdapter = {
  id: "codex",
  name: "Codex",
  configPath: (projectDir) => join(projectDir, ".codex", "config.toml"),
  isGlobal: false,

  toAgentFormat,
  fromAgentFormat,

  async read(projectDir) {
    const filePath = join(projectDir, ".codex", "config.toml");
    const { parsed } = await readTomlFile(filePath);
    return (parsed["mcp_servers"] as Record<string, unknown>) ?? {};
  },

  async write(projectDir, serverName, config) {
    const filePath = join(projectDir, ".codex", "config.toml");
    const { parsed } = await readTomlFile(filePath);
    const servers = (parsed["mcp_servers"] as Record<string, unknown>) ?? {};
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in Codex config`,
      );
    }
    const updated = {
      ...parsed,
      mcp_servers: { ...servers, [serverName]: toAgentFormat(config) },
    };
    await writeTomlFile(filePath, updated);
  },

  async remove(projectDir, serverName) {
    const filePath = join(projectDir, ".codex", "config.toml");
    const { parsed } = await readTomlFile(filePath);
    const servers = (parsed["mcp_servers"] as Record<string, unknown>) ?? {};
    const { [serverName]: _, ...rest } = servers;
    await writeTomlFile(filePath, { ...parsed, mcp_servers: rest });
  },

  async has(projectDir, serverName) {
    const filePath = join(projectDir, ".codex", "config.toml");
    const { parsed } = await readTomlFile(filePath);
    const servers = (parsed["mcp_servers"] as Record<string, unknown>) ?? {};
    return serverName in servers;
  },
};
