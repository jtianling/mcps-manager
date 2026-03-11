import { checkbox, confirm } from "@inquirer/prompts";
import { allAdapters, detectAgents } from "../adapters/index.js";
import { listServerDefinitions } from "../utils/server-store.js";
import { resolveConfig } from "../utils/resolve-config.js";
import type { AgentAdapter } from "../types.js";

export async function initCommand(): Promise<void> {
  const projectDir = process.cwd();

  const servers = await listServerDefinitions();
  if (servers.length === 0) {
    console.log(
      "Central repository is empty. Use \"mcpsmgr server add\" to add servers first.",
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
      checked: detectedIds.has(adapter.id),
    })),
  });

  if (selectedAgents.length === 0) {
    console.log("No agents selected.");
    return;
  }

  const selectedServers = await checkbox({
    message: "Select servers to deploy:",
    choices: servers.map((s) => ({
      name: `${s.name} [${s.default.transport}]`,
      value: s,
      checked: true,
    })),
  });

  if (selectedServers.length === 0) {
    console.log("No servers selected.");
    return;
  }

  console.log("\nPlan:");
  for (const agent of selectedAgents) {
    console.log(`  ${agent.name}:`);
    for (const server of selectedServers) {
      console.log(`    + ${server.name}`);
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

  console.log("\nDone.");
}
