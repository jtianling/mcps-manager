import { listServerDefinitions } from "../utils/server-store.js";

export async function serverListCommand(): Promise<void> {
  const servers = await listServerDefinitions();

  if (servers.length === 0) {
    console.log("No servers in central repository. Use \"mcpsmgr server add\" to add one.");
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
