import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";

const GLOBAL_CONFIG_PATH = join(
  homedir(),
  ".gemini",
  "antigravity",
  "mcp_config.json",
);

function toAgentFormat(config: DefaultConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    return {
      command: config.command,
      args: [...config.args],
      env: { ...config.env },
    };
  }
  return {
    serverUrl: config.url,
    headers: { ...config.headers },
  };
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  if (raw["command"]) {
    return {
      transport: "stdio",
      command: raw["command"] as string,
      args: (raw["args"] as string[]) ?? [],
      env: (raw["env"] as Record<string, string>) ?? {},
    };
  }
  if (raw["serverUrl"]) {
    return {
      transport: "http",
      url: raw["serverUrl"] as string,
      headers: (raw["headers"] as Record<string, string>) ?? {},
    };
  }
  return undefined;
}

export const antigravityAdapter: AgentAdapter = {
  id: "antigravity",
  name: "Antigravity",
  configPath: () => GLOBAL_CONFIG_PATH,
  isGlobal: true,

  toAgentFormat,
  fromAgentFormat,

  async read() {
    const data = await readJsonFile(GLOBAL_CONFIG_PATH);
    return (data["mcpServers"] as Record<string, unknown>) ?? {};
  },

  async write(_projectDir, serverName, config) {
    const data = await readJsonFile(GLOBAL_CONFIG_PATH);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in Antigravity config`,
      );
    }
    const updated = {
      ...data,
      mcpServers: { ...servers, [serverName]: toAgentFormat(config) },
    };
    await writeJsonFile(GLOBAL_CONFIG_PATH, updated);
  },

  async remove(_projectDir, serverName) {
    const data = await readJsonFile(GLOBAL_CONFIG_PATH);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    const { [serverName]: _, ...rest } = servers;
    await writeJsonFile(GLOBAL_CONFIG_PATH, { ...data, mcpServers: rest });
  },

  async has(_projectDir, serverName) {
    const data = await readJsonFile(GLOBAL_CONFIG_PATH);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    return serverName in servers;
  },
};
