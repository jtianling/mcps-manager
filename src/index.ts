import { program } from "commander";
import { configExists } from "./utils/config.js";
import { setupCommand } from "./commands/setup.js";
import { installCommand } from "./commands/install.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { syncCommand } from "./commands/sync.js";
import { listCommand } from "./commands/list.js";
import { customInstallCommand } from "./commands/custom-install.js";
import { updateCommand } from "./commands/update.js";

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
  .version("0.3.0");

program
  .command("setup")
  .description("Initialize mcpsmgr configuration")
  .action(setupCommand);

program
  .command("install [source]")
  .description("Install an MCP server (URL or GitHub owner/repo)")
  .action((source?: string) => {
    requireSetup();
    return installCommand(source);
  });

program
  .command("uninstall <name>")
  .description("Remove an MCP server from central repository")
  .action((name: string) => {
    requireSetup();
    return uninstallCommand(name);
  });

program
  .command("custom-install [name]")
  .alias("ci")
  .description("Install a local MCP server definition to central repository")
  .option("-f, --force", "Overwrite existing server without confirmation")
  .action((name: string | undefined, options: { force?: boolean }) => {
    requireSetup();
    return customInstallCommand(name, options);
  });

program
  .command("update [name]")
  .description(
    "Update installed servers by re-analyzing their source documentation",
  )
  .action((name?: string) => {
    requireSetup();
    return updateCommand(name);
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
  .description("List MCP servers (central repository by default, --deployed for project)")
  .option("-d, --deployed", "List servers deployed in current project")
  .action((options: { deployed?: boolean }) => {
    requireSetup();
    return listCommand(options);
  });

program.parse();
