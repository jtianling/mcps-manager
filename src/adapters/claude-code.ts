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
        command: "env",
        args: [...envArgs, config.command, ...resolvedArgs],
      };
    }
    return {
      command: config.command,
      args: resolvedArgs,
    };
  }
  const result: Record<string, unknown> = {
    type: "http",
    url: config.url,
  };
  if (Object.keys(config.headers).length > 0) {
    result["headers"] = { ...config.headers };
  }
  return result;
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  const type = raw["type"] as string | undefined;
  const isStdio = type === "stdio" || (type === undefined && raw["command"]);
  if (isStdio) {
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
  if (type === "http" || (type === undefined && raw["url"])) {
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
