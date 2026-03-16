import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { readJson5File, writeJson5File } from "./json5-file.js";
import { buildEnvArgs, parseEnvArgs, resolveEnvInArgs } from "./env-args.js";

const GLOBAL_CONFIG_PATH = join(
  homedir(),
  ".openclaw",
  "openclaw.json",
);

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
    headers: { ...config.headers },
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
      headers: (raw["headers"] as Record<string, string>) ?? {},
    };
  }
  return undefined;
}

export const openclawAdapter: AgentAdapter = {
  id: "openclaw",
  name: "OpenClaw",
  configPath: () => GLOBAL_CONFIG_PATH,
  isGlobal: true,

  toAgentFormat,
  fromAgentFormat,

  async read() {
    const data = await readJson5File(GLOBAL_CONFIG_PATH);
    return (data["mcpServers"] as Record<string, unknown>) ?? {};
  },

  async write(_projectDir, serverName, config) {
    const data = await readJson5File(GLOBAL_CONFIG_PATH);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in OpenClaw config`,
      );
    }
    const updated = {
      ...data,
      mcpServers: { ...servers, [serverName]: toAgentFormat(config) },
    };
    await writeJson5File(GLOBAL_CONFIG_PATH, updated);
  },

  async remove(_projectDir, serverName) {
    const data = await readJson5File(GLOBAL_CONFIG_PATH);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    const { [serverName]: _, ...rest } = servers;
    await writeJson5File(GLOBAL_CONFIG_PATH, { ...data, mcpServers: rest });
  },

  async has(_projectDir, serverName) {
    const data = await readJson5File(GLOBAL_CONFIG_PATH);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    return serverName in servers;
  },
};
