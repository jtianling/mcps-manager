import { checkbox } from "@inquirer/prompts";
import { allAdapters, detectAgents } from "../adapters/index.js";
import { readServerDefinition, serverExists } from "../utils/server-store.js";
import { resolveConfig } from "../utils/resolve-config.js";
import { CHECKBOX_DEFAULTS, isUserCancellation } from "../utils/prompt.js";
import type { AgentAdapter } from "../types.js";

export async function addCommand(serverName: string): Promise<void> {
  try {
    await addCommandInner(serverName);
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function addCommandInner(serverName: string): Promise<void> {
  const projectDir = process.cwd();

  if (!serverExists(serverName)) {
    console.error(
      `Error: Server "${serverName}" not found in central repository. Use "mcpsmgr install" to add it.`,
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

  const detectedIds = new Set(detectAgents(projectDir).map((a) => a.id));

  const selectedAgents = await checkbox<AgentAdapter>({
    message: `Select agents to add "${serverName}" to:`,
    choices: allAdapters.map((adapter) => ({
      name: `${adapter.name}${detectedIds.has(adapter.id) ? " (detected)" : ""}${adapter.isGlobal ? " [global]" : ""}`,
      value: adapter,
      checked: detectedIds.has(adapter.id) && !adapter.isGlobal,
    })),
    ...CHECKBOX_DEFAULTS,
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
