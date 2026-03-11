import { confirm } from "@inquirer/prompts";
import { allAdapters } from "../adapters/index.js";
import { listServerDefinitions } from "../utils/server-store.js";
import { resolveConfig } from "../utils/resolve-config.js";
import { isUserCancellation } from "../utils/prompt.js";

export async function syncCommand(): Promise<void> {
  try {
    await syncCommandInner();
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function syncCommandInner(): Promise<void> {
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
