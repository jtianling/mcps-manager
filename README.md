# mcpsmgr

Unified MCP (Model Context Protocol) server manager for multiple AI coding agents.

**[中文文档](./docs/README_zh-CN.md)**

## Problem

Each AI coding agent (Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity) uses its own config format for MCP servers. Managing the same servers across multiple agents means editing multiple config files manually, which is tedious and error-prone.

## Solution

`mcpsmgr` provides a central repository for MCP server definitions and syncs them to all your coding agents with a single command. Define once, deploy everywhere.

```
Central Repository          Agent Configs
┌──────────────────┐   ┌─► Claude Code (.claude.json)
│  server-a (stdio)│───┼─► Codex CLI   (.codex/config.toml)
│  server-b (http) │   ├─► Gemini CLI  (.gemini/settings.json)
│  server-c (stdio)│   ├─► OpenCode    (.opencode.json)
└──────────────────┘   └─► Antigravity (.antigravity/config.json)
```

## Features

- **Central server repository** - Define MCP servers once in `~/.mcps-manager/servers/`
- **Multi-agent support** - Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity
- **AI-assisted setup** - Provide a URL or GitHub repo, and GLM-5 analyzes the documentation to generate the config automatically
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
# 1. Initial setup (configure GLM API key)
mcpsmgr setup

# 2. Add a server to central repository
mcpsmgr server add https://github.com/anthropics/some-mcp-server

# Or add manually
mcpsmgr server add

# 3. Initialize a project (deploy servers to agents)
cd your-project
mcpsmgr init

# 4. Add a specific server to the current project
mcpsmgr add my-server

# 5. Sync central changes to project agents
mcpsmgr sync
```

## Commands

| Command | Description |
|---|---|
| `mcpsmgr setup` | Initialize global configuration |
| `mcpsmgr server add [source]` | Add a server to central repository (URL, GitHub owner/repo, or manual) |
| `mcpsmgr server remove <name>` | Remove a server from central repository |
| `mcpsmgr server list` | List all servers in central repository |
| `mcpsmgr init` | Deploy servers to agents in current project |
| `mcpsmgr add <server>` | Add a central server to current project |
| `mcpsmgr remove <server>` | Remove a server from current project |
| `mcpsmgr sync` | Sync central repository changes to project |
| `mcpsmgr list` | List MCP servers across all agents in current project |

## Supported Agents

| Agent | Config Location | Format |
|---|---|---|
| Claude Code | `.claude.json` (project) | JSON |
| Codex CLI | `.codex/config.toml` (project) | TOML |
| Gemini CLI | `.gemini/settings.json` (global) | JSON |
| OpenCode | `.opencode.json` (project) | JSON |
| Antigravity | `.antigravity/config.json` (project) | JSON |

## How It Works

1. **Central Repository** (`~/.mcps-manager/servers/`) stores server definitions as JSON files, each containing the server name, source, default config, and per-agent overrides.

2. **Agent Adapters** understand each agent's config format. When deploying, `mcpsmgr` resolves the final config (default + overrides) and writes it in the agent's native format.

3. **AI Analysis** (optional) uses GLM-5 to read MCP server documentation and auto-generate the server definition, including command, args, env vars, and transport type.

## License

MIT
