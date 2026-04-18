import { program } from "commander";
import { installCommand } from "./commands/install.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { deployCommand } from "./commands/deploy.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { listCommand } from "./commands/list.js";
import { updateCommand } from "./commands/update.js";

program
  .name("mcpsmgr")
  .description("Unified MCP server manager for multiple coding agents")
  .version("0.3.0");

program
  .command("install [source]")
  .description("Install an MCP server (GitHub URL, owner/repo, or local path)")
  .option("-f, --force", "Overwrite existing server without confirmation")
  .action((source: string | undefined, options: { force?: boolean }) => {
    return installCommand(source, options);
  });

program
  .command("uninstall <name>")
  .description("Remove an MCP server from central repository")
  .action((name: string) => uninstallCommand(name));

program
  .command("update [name]")
  .description(
    "Update installed servers by re-analyzing their source documentation",
  )
  .action((name?: string) => updateCommand(name));

program
  .command("deploy")
  .description("Deploy MCP servers to current project")
  .option("-r, --refresh", "Sync central repository changes to project agent configs")
  .action((options: { refresh?: boolean }) => deployCommand(options));

program
  .command("add <server-name>")
  .description("Add a server from central repository to current project")
  .action((serverName: string) => addCommand(serverName));

program
  .command("remove <server-name>")
  .description("Remove a server from current project agent configs")
  .action((serverName: string) => removeCommand(serverName));

program
  .command("list")
  .description("List MCP servers (central repository by default, --deployed for project)")
  .option("-d, --deployed", "List servers deployed in current project")
  .action((options: { deployed?: boolean }) => listCommand(options));

program.parse();
