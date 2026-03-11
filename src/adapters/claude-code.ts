import { join } from "node:path";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";

function toAgentFormat(config: DefaultConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    return {
      type: "stdio",
      command: config.command,
      args: [...config.args],
      env: { ...config.env },
    };
  }
  return {
    type: "http",
    url: config.url,
    headers: { ...config.headers },
  };
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  const type = raw["type"] as string | undefined;
  if (type === "stdio") {
    return {
      transport: "stdio",
      command: raw["command"] as string,
      args: (raw["args"] as string[]) ?? [],
      env: (raw["env"] as Record<string, string>) ?? {},
    };
  }
  if (type === "http") {
    return {
      transport: "http",
      url: raw["url"] as string,
      headers: (raw["headers"] as Record<string, string>) ?? {},
    };
  }
  return undefined;
}

export const claudeCodeAdapter: AgentAdapter = {
  id: "claude-code",
  name: "Claude Code",
  configPath: (projectDir) => join(projectDir, ".mcp.json"),
  isGlobal: false,

  toAgentFormat,
  fromAgentFormat,

  async read(projectDir) {
    const filePath = join(projectDir, ".mcp.json");
    const data = await readJsonFile(filePath);
    return (data["mcpServers"] as Record<string, unknown>) ?? {};
  },

  async write(projectDir, serverName, config) {
    const filePath = join(projectDir, ".mcp.json");
    const data = await readJsonFile(filePath);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in Claude Code config`,
      );
    }
    const updated = {
      ...data,
      mcpServers: { ...servers, [serverName]: toAgentFormat(config) },
    };
    await writeJsonFile(filePath, updated);
  },

  async remove(projectDir, serverName) {
    const filePath = join(projectDir, ".mcp.json");
    const data = await readJsonFile(filePath);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    const { [serverName]: _, ...rest } = servers;
    await writeJsonFile(filePath, { ...data, mcpServers: rest });
  },

  async has(projectDir, serverName) {
    const filePath = join(projectDir, ".mcp.json");
    const data = await readJsonFile(filePath);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    return serverName in servers;
  },
};
