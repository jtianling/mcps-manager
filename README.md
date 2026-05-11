# mcpsmgr

Unified MCP (Model Context Protocol) server manager for multiple AI coding agents — define MCP servers once, sync them to Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, and OpenClaw from one place.

**[中文文档](./docs/README_zh-CN.md)**

## Quick Start

```bash
# Install one or many MCP servers from a GitHub repo
npx mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code -y

# Or interactively pick which agent to deploy to
npx mcpsmgr add anthropics/some-mcp-server
```

That's it. `mcpsmgr` fetches the repo's `mcpsmgr.json` manifest (or falls back to README scanning), records the server in your central repository at `~/.mcps-manager/servers/`, and writes the right config into your agent's native file (`.claude.json`, `.codex/config.toml`, etc.).

Need to deploy already-installed servers into a fresh project? `cd` into the project and run `npx mcpsmgr deploy`.

## Install

```bash
npm install -g mcpsmgr     # or pnpm add -g / yarn global add
```

Or run anywhere without installing:

```bash
npx mcpsmgr <command>
```

## Adding servers to a project (`add`)

`mcpsmgr add` is the main entry point. It accepts three input shapes:

```bash
mcpsmgr add my-server                                  # already in central repo
mcpsmgr add owner/repo                                 # GitHub shorthand
mcpsmgr add https://github.com/owner/repo              # full GitHub URL
mcpsmgr add repo                                       # repo basename (bundle reverse-lookup)
```

The resolver picks the matching central entry or bundle when one exists, and falls back to fetching the manifest only when nothing is cached locally. This means re-running `add owner/repo` after the first install is fast and offline-safe.

### Useful flags

```
-a, --agent <id>     Target a specific agent without prompting
-y                   Unattended: auto-select detected agents, overwrite existing,
                     fail-fast on missing required vars/env (implies --force)
-f, --force          Overwrite existing central entries without confirmation
--port <number>      Override manifest variables.port (manifest-driven flow)
```

`-y` is the CI-friendly switch: one flag, no prompts. It will refuse rather than silently substitute defaults when a required variable or env var is missing — set those explicitly before re-running.

## Installing servers into the central repository (`install`)

`add` writes to the central repository as a side effect when it pulls a remote manifest. If you only want to register a server without touching any project, use `install`:

```bash
mcpsmgr install owner/repo                  # GitHub source (manifest or README scan)
mcpsmgr install https://github.com/o/r
mcpsmgr install ./my-mcp.json               # any agent's MCP JSON shape
mcpsmgr install ~/workspace/my-mcp-server   # local project directory
mcpsmgr install                             # interactive manual flow
```

GitHub sources also update `~/.mcps-manager/bundles.json` so later `add repo` calls can resolve back to every server the repo declared.

## Deploying to agents (`deploy`)

```bash
cd your-project
mcpsmgr deploy             # pick which central servers to deploy
mcpsmgr deploy --refresh   # re-sync existing project entries from central
```

`deploy` autodetects which agents the project already uses (presence of `.claude.json`, `.codex/`, etc.) and only writes to those. `--refresh` is the right command after you tweak a server definition in the central repository and want every project to pick up the change.

## Inspecting and removing

```bash
mcpsmgr list                  # central repository
mcpsmgr list --deployed       # what's wired up in the current project
mcpsmgr remove <name>         # remove from the current project (per-agent prompt)
mcpsmgr uninstall <name>      # remove from the central repository
mcpsmgr update [name]         # re-analyze sources and patch central definitions
```

`remove` only touches project agent configs. `uninstall` removes the central entry (and prunes it from any bundle it belongs to).

## Supported agents

| Agent | Config Location | Scope | Format |
|---|---|---|---|
| Claude Code | `.mcp.json` | project | JSON |
| Codex | `.codex/config.toml` | project | TOML |
| Cursor | `.cursor/mcp.json` | project | JSON |
| Gemini CLI | `.gemini/settings.json` | project | JSON |
| OpenCode | `opencode.json` | project | JSON |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | global | JSON |
| OpenClaw | `~/.openclaw/openclaw.json` | global | JSON5 |
| Hermes | `~/.hermes/config.yaml` | global | YAML |

> **Gotcha — global agents.** Antigravity, OpenClaw and Hermes share a single config across every project on the machine. `add` and `deploy` leave them unchecked by default; tick them only if you really want a host-wide change.

## GitHub bundles (reverse-lookup)

When a single GitHub repo declares multiple MCP servers via `mcpsmgr.json`, `mcpsmgr` records them as one **bundle**. After the first install, any of these inputs resolve to the same set of servers without going back to the network:

```bash
mcpsmgr add jtianling/cross-agent-teams-mcp        # owner/repo
mcpsmgr add https://github.com/jtianling/cross-agent-teams-mcp
mcpsmgr add cross-agent-teams-mcp                  # bare repo name
```

Bundles are stored in `~/.mcps-manager/bundles.json`. `install` updates the bundle membership on every successful manifest install; `uninstall <name>` prunes the member and drops the bundle when it becomes empty.

> **Gotcha — repo-name collisions.** If two different GitHub owners publish repos with the same basename and you've installed both, `mcpsmgr add <basename>` will refuse with a list of candidates. Disambiguate with `owner/repo`.

## License

MIT
