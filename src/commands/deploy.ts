import { checkbox, confirm } from "@inquirer/prompts";
import { allAdapters, detectAgents } from "../adapters/index.js";
import { listServerDefinitions } from "../utils/server-store.js";
import { resolveConfig } from "../utils/resolve-config.js";
import { isUserCancellation } from "../utils/prompt.js";
import type { AgentAdapter } from "../types.js";

export async function deployCommand(options: { refresh?: boolean }): Promise<void> {
  try {
    if (options.refresh) {
      await refreshInner();
    } else {
      await deployInner();
    }
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function deployInner(): Promise<void> {
  const projectDir = process.cwd();

  const servers = await listServerDefinitions();
  if (servers.length === 0) {
    console.log(
      "Central repository is empty. Use \"mcpsmgr install\" to add servers first.",
    );
    return;
  }

  const detected = detectAgents(projectDir);
  const detectedIds = new Set(detected.map((a) => a.id));

  const selectedAgents = await checkbox<AgentAdapter>({
    message: "Select agents to configure:",
    choices: allAdapters.map((adapter) => ({
      name: `${adapter.name}${detectedIds.has(adapter.id) ? " (detected)" : ""}${adapter.isGlobal ? " [global]" : ""}`,
      value: adapter,
      checked: detectedIds.has(adapter.id) && !adapter.isGlobal,
    })),
  });

  if (selectedAgents.length === 0) {
    console.log("No agents selected.");
    return;
  }

  const agentServerMap = new Map<string, Set<string>>();
  const detectedServers = new Set<string>();
  for (const agent of selectedAgents) {
    try {
      const existing = await agent.read(projectDir);
      const names = new Set(Object.keys(existing));
      agentServerMap.set(agent.id, names);
      for (const name of names) {
        detectedServers.add(name);
      }
    } catch {
      // silent fallback per design decision
    }
  }

  const selectedServers = await checkbox({
    message: "Select servers to deploy:",
    choices: servers.map((s) => ({
      name: `${s.name}${detectedServers.has(s.name) ? " (detected)" : ""} [${s.default.transport}]`,
      value: s,
      checked: detectedServers.has(s.name),
    })),
  });

  const selectedServerNames = new Set(selectedServers.map((s) => s.name));

  const removals = new Map<string, AgentAdapter[]>();
  for (const serverName of detectedServers) {
    if (!selectedServerNames.has(serverName)) {
      const agents = selectedAgents.filter((a) => {
        const agentServers = agentServerMap.get(a.id);
        return agentServers?.has(serverName);
      });
      if (agents.length > 0) {
        removals.set(serverName, agents);
      }
    }
  }

  if (selectedServers.length === 0 && removals.size === 0) {
    console.log("No servers selected.");
    return;
  }

  console.log("\nPlan:");
  for (const agent of selectedAgents) {
    console.log(`  ${agent.name}:`);
    for (const server of selectedServers) {
      console.log(`    + ${server.name}`);
    }
    for (const [serverName, agents] of removals) {
      if (agents.some((a) => a.id === agent.id)) {
        console.log(`    - ${serverName}`);
      }
    }
  }

  const proceed = await confirm({ message: "Proceed?" });
  if (!proceed) {
    console.log("Cancelled.");
    return;
  }

  for (const agent of selectedAgents) {
    for (const server of selectedServers) {
      try {
        const config = resolveConfig(server, agent);
        await agent.write(projectDir, server.name, config);
        console.log(`  + ${server.name} -> ${agent.name}`);
      } catch (error) {
        console.warn(
          `  ! ${server.name} -> ${agent.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  for (const [serverName, agents] of removals) {
    for (const agent of agents) {
      try {
        await agent.remove(projectDir, serverName);
        console.log(`  - ${serverName} <- ${agent.name}`);
      } catch (error) {
        console.warn(
          `  ! ${serverName} <- ${agent.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  console.log("\nDone.");
}

async function refreshInner(): Promise<void> {
  const projectDir = process.cwd();

  const definitions = await listServerDefinitions();
  if (definitions.length === 0) {
    console.log("Central repository is empty. Nothing to sync.");
    return;
  }

  const changes: Array<{
    agentName: string;
    serverName: string;
    action: "update" | "skip";
    reason?: string;
  }> = [];

  for (const adapter of allAdapters) {
    let servers: Record<string, unknown>;
    try {
      servers = await adapter.read(projectDir);
    } catch {
      continue;
    }

    for (const definition of definitions) {
      if (!(definition.name in servers)) {
        continue;
      }

      const currentRaw = servers[definition.name] as Record<string, unknown>;
      const desired = resolveConfig(definition, adapter);
      const desiredRaw = adapter.toAgentFormat(desired);

      if (JSON.stringify(currentRaw) !== JSON.stringify(desiredRaw)) {
        changes.push({
          agentName: adapter.name,
          serverName: definition.name,
          action: "update",
        });
      }
    }
  }

  if (changes.length === 0) {
    console.log("All agent configurations are up to date.");
    return;
  }

  console.log("\nSync preview:");
  for (const change of changes) {
    console.log(`  ~ ${change.serverName} -> ${change.agentName}`);
  }

  const proceed = await confirm({ message: "Apply changes?" });
  if (!proceed) {
    console.log("Cancelled.");
    return;
  }

  for (const adapter of allAdapters) {
    for (const definition of definitions) {
      const relevant = changes.find(
        (c) =>
          c.agentName === adapter.name &&
          c.serverName === definition.name,
      );
      if (!relevant) continue;

      try {
        await adapter.remove(projectDir, definition.name);
        const config = resolveConfig(definition, adapter);
        await adapter.write(projectDir, definition.name, config);
        console.log(`  ~ ${definition.name} -> ${adapter.name} (updated)`);
      } catch (error) {
        console.warn(
          `  ! ${definition.name} -> ${adapter.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  console.log("\nSync complete.");
}
