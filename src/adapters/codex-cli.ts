import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { AgentAdapter, DefaultConfig } from "../types.js";

function toAgentFormat(config: DefaultConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    return {
      command: config.command,
      args: [...config.args],
      env: { ...config.env },
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
    return {
      transport: "stdio",
      command: raw["command"] as string,
      args: (raw["args"] as string[]) ?? [],
      env: (raw["env"] as Record<string, string>) ?? {},
    };
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

export const codexCliAdapter: AgentAdapter = {
  id: "codex-cli",
  name: "Codex CLI",
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
        `Conflict: "${serverName}" already exists in Codex CLI config`,
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
