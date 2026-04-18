# mcpsmgr

统一的 MCP (Model Context Protocol) 服务器管理工具, 支持多种 AI 编程助手.

**[English](../README.md)**

## 问题

每个 AI 编程助手 (Claude Code, Codex, Gemini CLI, OpenCode, Antigravity) 都使用各自的配置格式来管理 MCP 服务器.  在多个助手之间管理相同的服务器意味着需要手动编辑多个配置文件, 既繁琐又容易出错.

## 解决方案

`mcpsmgr` 提供一个中央仓库来存储 MCP 服务器定义, 只需一条命令即可同步到所有编程助手.  定义一次, 到处部署.

```
中央仓库                     助手配置
┌──────────────────┐   ┌─► Claude Code (.claude.json)
│  server-a (stdio)│───┼─► Codex   (.codex/config.toml)
│  server-b (http) │   ├─► Gemini CLI  (.gemini/settings.json)
│  server-c (stdio)│   ├─► OpenCode    (.opencode.json)
└──────────────────┘   └─► Antigravity (.antigravity/config.json)
```

## 特性

- **中央服务器仓库** - 在 `~/.mcps-manager/servers/` 中统一定义 MCP 服务器
- **多助手支持** - Claude Code, Codex, Gemini CLI, OpenCode, Antigravity
- **基于规则的 README 解析** - 提供 GitHub URL 或 `owner/repo`, `mcpsmgr` 从 README 的 `claude mcp add` 命令行或 `mcpServers` JSON 块中抽取配置
- **本地源支持** - 可从 `*.json` 配置文件 (任何助手的 MCP 配置形状) 或本地项目目录 (自动探测 `package.json` / `pyproject.toml`) 安装
- **按助手覆盖** - 可针对特定助手自定义服务器配置
- **项目级部署** - 将选定的服务器部署到项目中检测到的助手
- **刷新同步** - 将中央仓库的更新推送到所有助手配置

## 安装

```bash
# 从源码安装
pnpm install
pnpm build
npm link
```

## 快速开始

```bash
# 1. 安装服务器到中央仓库
mcpsmgr install anthropics/some-mcp-server                # GitHub owner/repo
mcpsmgr install https://github.com/anthropics/some-repo   # GitHub URL
mcpsmgr install ./my-mcp.json                             # 本地 JSON 配置
mcpsmgr install ~/workspace/my-mcp-server                 # 本地项目目录

# 2. 将服务器部署到当前项目的助手
cd your-project
mcpsmgr deploy

# 3. 向当前项目添加特定服务器
mcpsmgr add my-server

# 4. 将中央仓库的变更同步到项目
mcpsmgr deploy --refresh

# 5. 更新已安装的服务器
mcpsmgr update
```

## 命令

| 命令 | 别名 | 说明 |
|---|---|---|
| `mcpsmgr install [source]` | | 安装服务器 (GitHub URL, owner/repo, 本地 JSON, 本地目录, 或手动) |
| `mcpsmgr uninstall <name>` | | 从中央仓库卸载服务器 |
| `mcpsmgr update [name]` | | 根据来源文档重新分析并更新已安装的服务器配置 |
| `mcpsmgr list` | | 列出中央仓库中的所有服务器 |
| `mcpsmgr list --deployed` | | 列出当前项目中所有助手的 MCP 服务器 |
| `mcpsmgr deploy` | | 将服务器部署到当前项目的助手 |
| `mcpsmgr deploy --refresh` | | 将中央仓库的变更同步到当前项目 |
| `mcpsmgr add <server>` | | 将中央仓库的服务器添加到当前项目 |
| `mcpsmgr remove <server>` | | 从当前项目移除服务器 |

## 支持的助手

| 助手 | 配置位置 | 格式 |
|---|---|---|
| Claude Code | `.claude.json` (项目级) | JSON |
| Codex | `.codex/config.toml` (项目级) | TOML |
| Gemini CLI | `.gemini/settings.json` (全局) | JSON |
| OpenCode | `.opencode.json` (项目级) | JSON |
| Antigravity | `.antigravity/config.json` (项目级) | JSON |

## 工作原理

1. **中央仓库** (`~/.mcps-manager/servers/`) 以 JSON 文件存储服务器定义, 每个文件包含服务器名称, 来源, 默认配置和按助手的覆盖配置.

2. **助手适配器** 理解每个助手的配置格式.  部署时, `mcpsmgr` 解析最终配置 (默认 + 覆盖) 并以助手的原生格式写入.

3. **基于规则的 README 分析** 在从 GitHub 来源安装时确定性运行. 它先扫 README 的 fenced code block 内的 `claude mcp add ...` 行, 再扫 `mcpServers` JSON 块, 然后是裸 `{command, args}` 块, 最后兜底查找 `package.json` / `pyproject.toml`. 都不命中则降级到手动向导.

## 许可证

MIT
