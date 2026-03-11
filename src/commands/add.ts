import { checkbox } from "@inquirer/prompts";
import { detectAgents } from "../adapters/index.js";
import { readServerDefinition, serverExists } from "../utils/server-store.js";
import { resolveConfig } from "../utils/resolve-config.js";
import type { AgentAdapter } from "../types.js";

export async function addCommand(serverName: string): Promise<void> {
  const projectDir = process.cwd();

  if (!serverExists(serverName)) {
    console.error(
      `Error: Server "${serverName}" not found in central repository.`,
    );
    process.exitCode = 1;
    return;
  }

  const definition = await readServerDefinition(serverName);
  if (!definition) {
    console.error(`Error: Failed to read server definition for "${serverName}".`);
    process.exitCode = 1;
    return;
  }

  const detected = detectAgents(projectDir);
  if (detected.length === 0) {
    console.log(
      "No agent config files detected in this project. Use \"mcpsmgr init\" first.",
    );
    return;
  }

  const selectedAgents = await checkbox<AgentAdapter>({
    message: `Select agents to add "${serverName}" to:`,
    choices: detected.map((adapter) => ({
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
      const config = resolveConfig(definition, agent);
      await agent.write(projectDir, serverName, config);
      console.log(`  + ${serverName} -> ${agent.name}`);
    } catch (error) {
      console.warn(
        `  ! ${serverName} -> ${agent.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
