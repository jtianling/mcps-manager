import { join } from "node:path";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";
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
        type: "local",
        command: ["env", ...envArgs, config.command, ...resolvedArgs],
      };
    }
    return {
      type: "local",
      command: [config.command, ...resolvedArgs],
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
    const legacyEnv = raw["environment"] as Record<string, string> | undefined;

    if (legacyEnv && Object.keys(legacyEnv).length > 0) {
      const [command = "", ...args] = commandArr;
      return { transport: "stdio", command, args, env: legacyEnv };
    }

    if (commandArr[0] === "env") {
      const { env, commandIndex } = parseEnvArgs(commandArr.slice(1));
      const actualIndex = commandIndex + 1;
      return {
        transport: "stdio",
        command: commandArr[actualIndex] ?? "",
        args: commandArr.slice(actualIndex + 1),
        env,
      };
    }

    const [command = "", ...args] = commandArr;
    return { transport: "stdio", command, args, env: {} };
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
