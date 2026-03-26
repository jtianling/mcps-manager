import { allAdapters } from "../adapters/index.js";
import { listServerDefinitions } from "../utils/server-store.js";
import type { AgentAdapter } from "../types.js";

interface ServerEntry {
  transport: string;
}

export async function listCommand(options: {
  deployed?: boolean;
}): Promise<void> {
  if (options.deployed) {
    await listDeployed();
  } else {
    await listInstalled();
  }
}

async function listInstalled(): Promise<void> {
  const servers = await listServerDefinitions();

  if (servers.length === 0) {
    console.log(
      'No servers in central repository. Use "mcpsmgr install" to add one.',
    );
    return;
  }

  console.log("\nCentral Repository Servers:\n");
  for (const server of servers) {
    const overrideCount = Object.keys(server.overrides).length;
    const overrideInfo =
      overrideCount > 0 ? ` (${overrideCount} overrides)` : "";
    console.log(
      `  ${server.name} [${server.default.transport}]${overrideInfo}`,
    );
    if (server.source) {
      console.log(`    source: ${server.source}`);
    }
  }
  console.log();
}

async function listDeployed(): Promise<void> {
  const projectDir = process.cwd();

  const matrix: Record<string, Record<string, ServerEntry>> = {};
  const activeAdapters: AgentAdapter[] = [];

  for (const adapter of allAdapters) {
    let servers: Record<string, unknown>;
    try {
      servers = await adapter.read(projectDir);
    } catch {
      continue;
    }

    if (Object.keys(servers).length === 0) continue;

    activeAdapters.push(adapter);
    for (const [name, raw] of Object.entries(servers)) {
      if (!matrix[name]) {
        matrix[name] = {};
      }
      const config = adapter.fromAgentFormat(
        name,
        raw as Record<string, unknown>,
      );
      matrix[name][adapter.id] = {
        transport: config?.transport ?? "?",
      };
    }
  }

  if (Object.keys(matrix).length === 0) {
    console.log(
      'No MCP servers found in any agent configuration. Use "mcpsmgr init" to get started.',
    );
    return;
  }

  const serverNames = Object.keys(matrix).sort();
  const agentIds = activeAdapters.map((a) => a.id);
  const agentNames = activeAdapters.map((a) => a.name);

  const colWidths = [
    Math.max(6, ...serverNames.map((n) => n.length)),
    ...agentNames.map((n) => Math.max(n.length, 5)),
  ];

  const header = [
    "Server".padEnd(colWidths.at(0) ?? 6),
    ...agentNames.map((n, i) => n.padEnd(colWidths.at(i + 1) ?? 5)),
  ].join("  ");

  const separator = colWidths.map((w) => "-".repeat(w)).join("  ");

  console.log(`\n${header}`);
  console.log(separator);

  for (const name of serverNames) {
    const cells = [
      name.padEnd(colWidths.at(0) ?? 6),
      ...agentIds.map((id, i) => {
        const entry = matrix[name][id];
        const val = entry ? entry.transport : "-";
        return val.padEnd(colWidths.at(i + 1) ?? 5);
      }),
    ];
    console.log(cells.join("  "));
  }
  console.log();
}
