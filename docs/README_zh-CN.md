# mcpsmgr

统一的 MCP (Model Context Protocol) 服务器管理工具, 支持多种 AI 编程助手.

**[English](../README.md)**

## 问题

每个 AI 编程助手 (Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity) 都使用各自的配置格式来管理 MCP 服务器.  在多个助手之间管理相同的服务器意味着需要手动编辑多个配置文件, 既繁琐又容易出错.

## 解决方案

`mcpsmgr` 提供一个中央仓库来存储 MCP 服务器定义, 只需一条命令即可同步到所有编程助手.  定义一次, 到处部署.

```
中央仓库                     助手配置
┌──────────────────┐   ┌─► Claude Code (.claude.json)
│  server-a (stdio)│───┼─► Codex CLI   (.codex/config.toml)
│  server-b (http) │   ├─► Gemini CLI  (.gemini/settings.json)
│  server-c (stdio)│   ├─► OpenCode    (.opencode.json)
└──────────────────┘   └─► Antigravity (.antigravity/config.json)
```

## 特性

- **中央服务器仓库** - 在 `~/.mcps-manager/servers/` 中统一定义 MCP 服务器
- **多助手支持** - Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity
- **AI 辅助配置** - 提供 URL 或 GitHub 仓库地址, GLM-5 自动分析文档并生成配置
- **按助手覆盖** - 可针对特定助手自定义服务器配置
- **项目级初始化** - 将选定的服务器部署到项目中检测到的助手
- **同步** - 将中央仓库的更新推送到所有助手配置

## 安装

```bash
# 从源码安装
pnpm install
pnpm build
npm link
```

## 快速开始

```bash
# 1. 初始化配置 (设置 GLM API 密钥)
mcpsmgr setup

# 2. 添加服务器到中央仓库
mcpsmgr server add https://github.com/anthropics/some-mcp-server

# 或手动添加
mcpsmgr server add

# 3. 初始化项目 (将服务器部署到助手)
cd your-project
mcpsmgr init

# 4. 向当前项目添加特定服务器
mcpsmgr add my-server

# 5. 将中央仓库的变更同步到项目
mcpsmgr sync
```

## 命令

| 命令 | 说明 |
|---|---|
| `mcpsmgr setup` | 初始化全局配置 |
| `mcpsmgr server add [source]` | 添加服务器到中央仓库 (URL, GitHub owner/repo, 或手动) |
| `mcpsmgr server remove <name>` | 从中央仓库移除服务器 |
| `mcpsmgr server list` | 列出中央仓库中的所有服务器 |
| `mcpsmgr init` | 将服务器部署到当前项目的助手 |
| `mcpsmgr add <server>` | 将中央仓库的服务器添加到当前项目 |
| `mcpsmgr remove <server>` | 从当前项目移除服务器 |
| `mcpsmgr sync` | 将中央仓库的变更同步到当前项目 |
| `mcpsmgr list` | 列出当前项目中所有助手的 MCP 服务器 |

## 支持的助手

| 助手 | 配置位置 | 格式 |
|---|---|---|
| Claude Code | `.claude.json` (项目级) | JSON |
| Codex CLI | `.codex/config.toml` (项目级) | TOML |
| Gemini CLI | `.gemini/settings.json` (全局) | JSON |
| OpenCode | `.opencode.json` (项目级) | JSON |
| Antigravity | `.antigravity/config.json` (项目级) | JSON |

## 工作原理

1. **中央仓库** (`~/.mcps-manager/servers/`) 以 JSON 文件存储服务器定义, 每个文件包含服务器名称, 来源, 默认配置和按助手的覆盖配置.

2. **助手适配器** 理解每个助手的配置格式.  部署时, `mcpsmgr` 解析最终配置 (默认 + 覆盖) 并以助手的原生格式写入.

3. **AI 分析** (可选) 使用 GLM-5 读取 MCP 服务器文档, 自动生成服务器定义, 包括命令, 参数, 环境变量和传输类型.

## 许可证

MIT
