# mcpsmgr

Unified MCP (Model Context Protocol) server manager for multiple AI coding agents.

**[中文文档](./docs/README_zh-CN.md)**

## Problem

Each AI coding agent (Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity) uses its own config format for MCP servers. Managing the same servers across multiple agents means editing multiple config files manually, which is tedious and error-prone.

## Solution

`mcpsmgr` provides a central repository for MCP server definitions and syncs them to all your coding agents with a single command. Define once, deploy everywhere.

```
Central Repository          Agent Configs
┌──────────────────┐   ┌─► Claude Code (.claude.json)
│  server-a (stdio)│───┼─► Codex   (.codex/config.toml)
│  server-b (http) │   ├─► Cursor      (.cursor/mcp.json)
│  server-c (stdio)│   ├─► Gemini CLI  (.gemini/settings.json)
└──────────────────┘   ├─► OpenCode    (.opencode.json)
                       └─► Antigravity (.antigravity/config.json)
```

## Features

- **Central server repository** - Define MCP servers once in `~/.mcps-manager/servers/`
- **Multi-agent support** - Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity
- **Rule-based README parsing** - Provide a GitHub URL or `owner/repo` and `mcpsmgr` extracts the config from `claude mcp add` lines or `mcpServers` JSON blocks in the README
- **GitHub bundle 反查** - 通过 GitHub manifest 安装的多服务器仓库会记录 `repoName` 和 `bundleId`, 后续可用 `owner/repo`, GitHub URL, 或 repo basename 直接添加同一组服务器
- **Local source support** - Install from a `*.json` file (any agent's MCP config shape) or from a project directory (auto-detects `package.json` / `pyproject.toml`)
- **Per-agent overrides** - Customize server config for specific agents when needed
- **Project-level deploy** - Deploy selected servers to detected agents in any project
- **Refresh** - Push central repository updates to all agent configs

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

# 2. Deploy servers to agents in current project
cd your-project
mcpsmgr deploy

# 3. Add a specific server to the current project
mcpsmgr add my-server
mcpsmgr add anthropics/some-mcp-server                   # GitHub source
mcpsmgr add some-mcp-server                              # Installed repo basename bundle

# 4. Sync central changes to project agents
mcpsmgr deploy --refresh

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
| `mcpsmgr deploy` | | Deploy servers to agents in current project |
| `mcpsmgr deploy --refresh` | | Sync central repository changes to project |
| `mcpsmgr add <server>` | | Add a central server to current project |
| `mcpsmgr remove <server>` | | Remove a server from current project |

## GitHub Bundle 反查

从 GitHub source 安装服务时, `mcpsmgr` 会把归一化后的仓库 URL 写入 `~/.mcps-manager/bundles.json`, 并在每个 server definition 上保存可选的 `repoName` 和 `bundleId`.  这让同一个远端仓库的多 server manifest 可以被三种输入精准命中:

- `mcpsmgr add owner/repo`
- `mcpsmgr add https://github.com/owner/repo`
- `mcpsmgr add repo` (当中央仓库没有同名 server, 且已安装条目的 `repoName` 等于 `repo`)

`add` 会先解析本地 server 或 bundle.  命中后只写入选定 agent, 不重新拉取 manifest, 不询问覆盖中央仓库.  只有 `owner/repo` 或 GitHub URL 在本地找不到 bundle 时, 才会走远端 manifest 或 README fallback.

`install` 会在 GitHub 来源成功写入 server 后同步更新 bundle members.  本地路径和手动安装不会写入 `repoName` / `bundleId`.

`uninstall <name>` 删除中央 server 时, 如果该 server 属于某个 bundle, 会同步从 `bundles.json` 的 members 中移除它.  最后一个 member 被移除后, 对应 bundle 条目会自动删除.

## Supported Agents

| Agent | Config Location | Format |
|---|---|---|
| Claude Code | `.claude.json` (project) | JSON |
| Codex | `.codex/config.toml` (project) | TOML |
| Cursor | `.cursor/mcp.json` (project) | JSON |
| Gemini CLI | `.gemini/settings.json` (global) | JSON |
| OpenCode | `.opencode.json` (project) | JSON |
| Antigravity | `.antigravity/config.json` (project) | JSON |

## How It Works

1. **Central Repository** (`~/.mcps-manager/servers/`) stores server definitions as JSON files, each containing the server name, source, optional GitHub bundle metadata, default config, and per-agent overrides.  `~/.mcps-manager/bundles.json` stores GitHub bundle to server members mappings.

2. **Agent Adapters** understand each agent's config format. When deploying, `mcpsmgr` resolves the final config (default + overrides) and writes it in the agent's native format.

3. **Rule-based README analysis** runs deterministically when installing from a GitHub source. It scans the README for `claude mcp add ...` lines inside fenced code blocks, then for `mcpServers` JSON blocks, then bare `{command, args}` blocks, and finally falls back to `package.json` / `pyproject.toml` lookups. If no shape matches, the install drops to the manual prompt flow.

## License

MIT
