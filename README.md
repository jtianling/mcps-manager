# mcpsmgr

Unified MCP (Model Context Protocol) server manager for multiple AI coding agents.

**[中文文档](./docs/README_zh-CN.md)**

## Problem

Each AI coding agent (Claude Code, Codex, Gemini CLI, OpenCode, Antigravity) uses its own config format for MCP servers. Managing the same servers across multiple agents means editing multiple config files manually, which is tedious and error-prone.

## Solution

`mcpsmgr` provides a central repository for MCP server definitions and syncs them to all your coding agents with a single command. Define once, deploy everywhere.

```
Central Repository          Agent Configs
┌──────────────────┐   ┌─► Claude Code (.claude.json)
│  server-a (stdio)│───┼─► Codex   (.codex/config.toml)
│  server-b (http) │   ├─► Gemini CLI  (.gemini/settings.json)
│  server-c (stdio)│   ├─► OpenCode    (.opencode.json)
└──────────────────┘   └─► Antigravity (.antigravity/config.json)
```

## Features

- **Central server repository** - Define MCP servers once in `~/.mcps-manager/servers/`
- **Multi-agent support** - Claude Code, Codex, Gemini CLI, OpenCode, Antigravity
- **Rule-based README parsing** - Provide a GitHub URL or `owner/repo` and `mcpsmgr` extracts the config from `claude mcp add` lines or `mcpServers` JSON blocks in the README
- **Local source support** - Install from a `*.json` file (any agent's MCP config shape) or from a project directory (auto-detects `package.json` / `pyproject.toml`)
- **Per-agent overrides** - Customize server config for specific agents when needed
- **Project-level init** - Deploy selected servers to detected agents in any project
- **Sync** - Push central repository updates to all agent configs

## Installation

```bash
# From source
pnpm install
pnpm build
npm link
```

## Quick Start

```bash
# 1. Install a server to central repository
mcpsmgr install anthropics/some-mcp-server                # GitHub owner/repo
mcpsmgr install https://github.com/anthropics/some-repo   # GitHub URL
mcpsmgr install ./my-mcp.json                             # Local JSON config
mcpsmgr install ~/workspace/my-mcp-server                 # Local project dir

# 2. Initialize a project (deploy servers to agents)
cd your-project
mcpsmgr init

# 3. Add a specific server to the current project
mcpsmgr add my-server

# 4. Sync central changes to project agents
mcpsmgr sync

# 5. Update installed servers from their sources
mcpsmgr update
```

## Commands

| Command | Alias | Description |
|---|---|---|
| `mcpsmgr install [source]` | | Install a server (GitHub URL, owner/repo, local JSON, local dir, or manual) |
| `mcpsmgr uninstall <name>` | | Remove a server from central repository |
| `mcpsmgr update [name]` | | Update installed servers by re-analyzing their source documentation |
| `mcpsmgr list` | | List all servers in central repository |
| `mcpsmgr list --deployed` | | List MCP servers across all agents in current project |
| `mcpsmgr init` | | Deploy servers to agents in current project |
| `mcpsmgr add <server>` | | Add a central server to current project |
| `mcpsmgr remove <server>` | | Remove a server from current project |
| `mcpsmgr sync` | | Sync central repository changes to project |

## Supported Agents

| Agent | Config Location | Format |
|---|---|---|
| Claude Code | `.claude.json` (project) | JSON |
| Codex | `.codex/config.toml` (project) | TOML |
| Gemini CLI | `.gemini/settings.json` (global) | JSON |
| OpenCode | `.opencode.json` (project) | JSON |
| Antigravity | `.antigravity/config.json` (project) | JSON |

## How It Works

1. **Central Repository** (`~/.mcps-manager/servers/`) stores server definitions as JSON files, each containing the server name, source, default config, and per-agent overrides.

2. **Agent Adapters** understand each agent's config format. When deploying, `mcpsmgr` resolves the final config (default + overrides) and writes it in the agent's native format.

3. **Rule-based README analysis** runs deterministically when installing from a GitHub source. It scans the README for `claude mcp add ...` lines inside fenced code blocks, then for `mcpServers` JSON blocks, then bare `{command, args}` blocks, and finally falls back to `package.json` / `pyproject.toml` lookups. If no shape matches, the install drops to the manual prompt flow.

## License

MIT
