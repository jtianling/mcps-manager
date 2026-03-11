import { join } from "node:path";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";

function toAgentFormat(config: DefaultConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    return {
      type: "local",
      command: [config.command, ...config.args],
      environment: { ...config.env },
    };
  }
  return {
    type: "remote",
    url: config.url,
    headers: { ...config.headers },
  };
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  const type = raw["type"] as string | undefined;
  if (type === "local") {
    const commandArr = raw["command"] as string[];
    const [command = "", ...args] = commandArr;
    return {
      transport: "stdio",
      command,
      args,
      env: (raw["environment"] as Record<string, string>) ?? {},
    };
  }
  if (type === "remote") {
    return {
      transport: "http",
      url: raw["url"] as string,
      headers: (raw["headers"] as Record<string, string>) ?? {},
    };
  }
  return undefined;
}

export const opencodeAdapter: AgentAdapter = {
  id: "opencode",
  name: "OpenCode",
  configPath: (projectDir) => join(projectDir, "opencode.json"),
  isGlobal: false,

  toAgentFormat,
  fromAgentFormat,

  async read(projectDir) {
    const filePath = join(projectDir, "opencode.json");
    const data = await readJsonFile(filePath);
    return (data["mcp"] as Record<string, unknown>) ?? {};
  },

  async write(projectDir, serverName, config) {
    const filePath = join(projectDir, "opencode.json");
    const data = await readJsonFile(filePath);
    const servers = (data["mcp"] as Record<string, unknown>) ?? {};
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in OpenCode config`,
      );
    }
    const updated = {
      ...data,
      mcp: { ...servers, [serverName]: toAgentFormat(config) },
    };
    await writeJsonFile(filePath, updated);
  },

  async remove(projectDir, serverName) {
    const filePath = join(projectDir, "opencode.json");
    const data = await readJsonFile(filePath);
    const servers = (data["mcp"] as Record<string, unknown>) ?? {};
    const { [serverName]: _, ...rest } = servers;
    await writeJsonFile(filePath, { ...data, mcp: rest });
  },

  async has(projectDir, serverName) {
    const filePath = join(projectDir, "opencode.json");
    const data = await readJsonFile(filePath);
    const servers = (data["mcp"] as Record<string, unknown>) ?? {};
    return serverName in servers;
  },
};
