import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { readJson5File, writeJson5File } from "./json5-file.js";
import { resolveEnvInArgs } from "./env-args.js";

const GLOBAL_CONFIG_PATH = join(
  homedir(),
  ".openclaw",
  "openclaw.json",
);

function getMcpServers(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const plugins = data["plugins"] as Record<string, unknown> | undefined;
  const entries = plugins?.["entries"] as Record<string, unknown> | undefined;
  const acpx = entries?.["acpx"] as Record<string, unknown> | undefined;
  return (acpx?.["mcpServers"] as Record<string, unknown>) ?? {};
}

function setMcpServers(
  data: Record<string, unknown>,
  servers: Record<string, unknown>,
): Record<string, unknown> {
  const plugins = (data["plugins"] as Record<string, unknown>) ?? {};
  const entries = (plugins["entries"] as Record<string, unknown>) ?? {};
  const acpx = (entries["acpx"] as Record<string, unknown>) ?? {};
  return {
    ...data,
    plugins: {
      ...plugins,
      entries: {
        ...entries,
        acpx: {
          ...acpx,
          enabled: true,
          mcpServers: servers,
        },
      },
    },
  };
}

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
  const args = ["-y", "mcp-remote@latest", config.url];
  for (const [key, value] of Object.entries(config.headers)) {
    args.push("--header", `${key}: ${value}`);
  }
  return {
    command: "npx",
    args,
  };
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  if (!raw["command"]) {
    return undefined;
  }
  const command = raw["command"] as string;
  const rawArgs = (raw["args"] as string[]) ?? [];
  const env = (raw["env"] as Record<string, string>) ?? {};
  return { transport: "stdio", command, args: rawArgs, env };
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
    return getMcpServers(data);
  },

  async write(_projectDir, serverName, config) {
    const data = await readJson5File(GLOBAL_CONFIG_PATH);
    const servers = getMcpServers(data);
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in OpenClaw config`,
      );
    }
    const updated = setMcpServers(data, {
      ...servers,
      [serverName]: toAgentFormat(config),
    });
    await writeJson5File(GLOBAL_CONFIG_PATH, updated);
  },

  async remove(_projectDir, serverName) {
    const data = await readJson5File(GLOBAL_CONFIG_PATH);
    const servers = getMcpServers(data);
    const { [serverName]: _, ...rest } = servers;
    await writeJson5File(GLOBAL_CONFIG_PATH, setMcpServers(data, rest));
  },

  async has(_projectDir, serverName) {
    const data = await readJson5File(GLOBAL_CONFIG_PATH);
    const servers = getMcpServers(data);
    return serverName in servers;
  },
};
