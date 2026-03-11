import { program } from "commander";
import { configExists } from "./utils/config.js";
import { setupCommand } from "./commands/setup.js";
import { serverAddCommand } from "./commands/server-add.js";
import { serverRemoveCommand } from "./commands/server-remove.js";
import { serverListCommand } from "./commands/server-list.js";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { syncCommand } from "./commands/sync.js";
import { listCommand } from "./commands/list.js";

function requireSetup(): void {
  if (!configExists()) {
    console.error(
      'mcpsmgr is not configured. Run "mcpsmgr setup" first.',
    );
    process.exit(1);
  }
}

program
  .name("mcpsmgr")
  .description("Unified MCP server manager for multiple coding agents")
  .version("0.1.0");

program
  .command("setup")
  .description("Initialize mcpsmgr configuration")
  .action(setupCommand);

const server = program
  .command("server")
  .description("Manage MCP server definitions in central repository");

server
  .command("add [source]")
  .description("Add an MCP server (URL or GitHub owner/repo)")
  .action((source?: string) => {
    requireSetup();
    return serverAddCommand(source);
  });

server
  .command("remove <name>")
  .description("Remove an MCP server from central repository")
  .action((name: string) => {
    requireSetup();
    return serverRemoveCommand(name);
  });

server
  .command("list")
  .description("List all servers in central repository")
  .action(() => {
    requireSetup();
    return serverListCommand();
  });

program
  .command("init")
  .description("Initialize MCP servers for current project")
  .action(() => {
    requireSetup();
    return initCommand();
  });

program
  .command("add <server-name>")
  .description("Add a server from central repository to current project")
  .action((serverName: string) => {
    requireSetup();
    return addCommand(serverName);
  });

program
  .command("remove <server-name>")
  .description("Remove a server from current project agent configs")
  .action((serverName: string) => {
    requireSetup();
    return removeCommand(serverName);
  });

program
  .command("sync")
  .description("Sync central repository changes to project agent configs")
  .action(() => {
    requireSetup();
    return syncCommand();
  });

program
  .command("list")
  .description("List MCP servers across all agent configs in current project")
  .action(() => {
    requireSetup();
    return listCommand();
  });

program.parse();
