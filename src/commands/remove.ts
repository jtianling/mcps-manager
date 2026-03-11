import { checkbox } from "@inquirer/prompts";
import { allAdapters } from "../adapters/index.js";
import type { AgentAdapter } from "../types.js";

export async function removeCommand(serverName: string): Promise<void> {
  const projectDir = process.cwd();

  const agentsWithServer: AgentAdapter[] = [];
  for (const adapter of allAdapters) {
    try {
      const has = await adapter.has(projectDir, serverName);
      if (has) {
        agentsWithServer.push(adapter);
      }
    } catch {
      // config file doesn't exist, skip
    }
  }

  if (agentsWithServer.length === 0) {
    console.log(
      `Server "${serverName}" not found in any agent configuration.`,
    );
    return;
  }

  const selectedAgents = await checkbox<AgentAdapter>({
    message: `Remove "${serverName}" from which agents?`,
    choices: agentsWithServer.map((adapter) => ({
      name: `${adapter.name}${adapter.isGlobal ? " [global]" : ""}`,
      value: adapter,
      checked: true,
    })),
  });

  if (selectedAgents.length === 0) {
    console.log("No agents selected.");
    return;
  }

  for (const agent of selectedAgents) {
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
