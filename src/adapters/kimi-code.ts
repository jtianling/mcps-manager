import { join } from "node:path";
import { homedir } from "node:os";
import type { AgentAdapter, DefaultConfig } from "../types.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";
import { parseEnvArgs, resolveEnvInArgs } from "./env-args.js";

const CONFIG_SEGMENTS = [".kimi-code", "mcp.json"] as const;

function configFile(projectDir: string): string {
  return join(projectDir, ...CONFIG_SEGMENTS);
}

function enabledField(config: DefaultConfig): Record<string, boolean> {
  return config.enabled !== undefined ? { enabled: config.enabled } : {};
}

function toAgentFormat(config: DefaultConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    const { resolvedArgs, remainingEnv } = resolveEnvInArgs(
      config.args,
      config.env,
    );
    return {
      transport: "stdio",
      command: config.command,
      args: resolvedArgs,
      ...(Object.keys(remainingEnv).length > 0
        ? { env: { ...remainingEnv } }
        : {}),
      ...enabledField(config),
    };
  }
  const headers = config.bearerTokenEnvVar
    ? Object.fromEntries(
        Object.entries(config.headers).filter(
          ([key]) => key.toLowerCase() !== "authorization",
        ),
      )
    : { ...config.headers };
  return {
    transport: "http",
    url: config.url,
    ...(config.bearerTokenEnvVar
      ? { bearerTokenEnvVar: config.bearerTokenEnvVar }
      : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...enabledField(config),
  };
}

function readEnabled(raw: Record<string, unknown>): Record<string, boolean> {
  return typeof raw["enabled"] === "boolean"
    ? { enabled: raw["enabled"] }
    : {};
}

function fromAgentFormat(
  _name: string,
  raw: Record<string, unknown>,
): DefaultConfig | undefined {
  const transport = raw["transport"] as string | undefined;
  const isStdio =
    transport === "stdio" || (transport === undefined && raw["command"]);
  if (isStdio) {
    const command = raw["command"] as string;
    const rawArgs = (raw["args"] as string[]) ?? [];
    const nativeEnv = raw["env"] as Record<string, string> | undefined;

    if (nativeEnv && Object.keys(nativeEnv).length > 0) {
      return {
        transport: "stdio",
        command,
        args: rawArgs,
        env: nativeEnv,
        ...readEnabled(raw),
      };
    }

    if (command === "env") {
      const { env, commandIndex } = parseEnvArgs(rawArgs);
      return {
        transport: "stdio",
        command: rawArgs[commandIndex] ?? "",
        args: rawArgs.slice(commandIndex + 1),
        env,
        ...readEnabled(raw),
      };
    }

    return {
      transport: "stdio",
      command,
      args: rawArgs,
      env: {},
      ...readEnabled(raw),
    };
  }
  // Kimi accepts "sse" too, but DefaultConfig has no SSE variant; reading one
  // back as plain http keeps the url/headers usable instead of dropping it.
  const isHttp =
    transport === "http" ||
    transport === "sse" ||
    (transport === undefined && raw["url"]);
  if (isHttp) {
    const bearer = raw["bearerTokenEnvVar"];
    return {
      transport: "http",
      url: raw["url"] as string,
      headers: (raw["headers"] as Record<string, string>) ?? {},
      ...(typeof bearer === "string" && bearer !== ""
        ? { bearerTokenEnvVar: bearer }
        : {}),
      ...readEnabled(raw),
    };
  }
  return undefined;
}

export const kimiCodeAdapter: AgentAdapter = {
  id: "kimi-code",
  name: "Kimi Code",
  configPath: configFile,
  isGlobal: false,
  // Kimi resolves its user-global MCP file as <KIMI_CODE_HOME>/mcp.json,
  // defaulting to ~/.kimi-code/mcp.json, so the home dir joins to the same path.
  globalDir: () => homedir(),

  toAgentFormat,
  fromAgentFormat,

  async read(projectDir) {
    const data = await readJsonFile(configFile(projectDir));
    return (data["mcpServers"] as Record<string, unknown>) ?? {};
  },

  async write(projectDir, serverName, config) {
    const filePath = configFile(projectDir);
    const data = await readJsonFile(filePath);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    if (serverName in servers) {
      throw new Error(
        `Conflict: "${serverName}" already exists in Kimi Code config`,
      );
    }
    const updated = {
      ...data,
      mcpServers: { ...servers, [serverName]: toAgentFormat(config) },
    };
    await writeJsonFile(filePath, updated);
  },

  async remove(projectDir, serverName) {
    const filePath = configFile(projectDir);
    const data = await readJsonFile(filePath);
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    const { [serverName]: _, ...rest } = servers;
    await writeJsonFile(filePath, { ...data, mcpServers: rest });
  },

  async has(projectDir, serverName) {
    const data = await readJsonFile(configFile(projectDir));
    const servers = (data["mcpServers"] as Record<string, unknown>) ?? {};
    return serverName in servers;
  },
};
