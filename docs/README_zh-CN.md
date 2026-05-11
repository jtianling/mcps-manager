# mcpsmgr

统一的 MCP (Model Context Protocol) 服务器管理工具 —— 一次定义, 同步部署到 Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, OpenClaw 等多个 AI coding agent.

**[English](../README.md)**

## Quick Start

```bash
# 从 GitHub 仓库一次性安装一个或多个 MCP server
npx mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code -y

# 或交互式选择部署到哪个 agent
npx mcpsmgr add anthropics/some-mcp-server
```

`mcpsmgr` 会拉取仓库根目录的 `mcpsmgr.json` manifest (没有就 fallback 到 README 扫描), 把 server 记录到中央仓库 `~/.mcps-manager/servers/`, 再用各 agent 原生格式写入对应配置文件 (`.claude.json`, `.codex/config.toml` 等).

已经装好的 server 要部署到新项目? `cd` 进项目目录运行 `npx mcpsmgr deploy` 即可.

## 安装

```bash
npm install -g mcpsmgr     # 或 pnpm add -g / yarn global add
```

也可以不装直接用:

```bash
npx mcpsmgr <command>
```

## 把 server 加进项目 (`add`)

`mcpsmgr add` 是最主要的入口, 接受三种输入形态:

```bash
mcpsmgr add my-server                                  # 已在中央仓库
mcpsmgr add owner/repo                                 # GitHub 简写
mcpsmgr add https://github.com/owner/repo              # 完整 GitHub URL
mcpsmgr add repo                                       # repo basename (bundle 反查)
```

resolver 先尝试命中本地中央条目或 bundle, 找不到才拉取远端 manifest. 这意味着首次 `add owner/repo` 之后, 再次执行同样命令是离线快路径, 不会重新拉网络.

### 常用 flag

```
-a, --agent <id>     直接指定 agent, 跳过交互选择
-y                   一次性跳过所有 prompt: 自动选已检测 agent, 覆盖已有中央
                     条目, 必需 var/env 缺失则 fail-fast (隐含 --force)
-f, --force          仅跳过中央条目覆盖确认, 不影响其它交互
--port <number>      覆盖 manifest 中 variables.port (manifest 路径专用)
```

`-y` 是 CI / 脚本场景的开关: 一行解决所有 prompt. 它**不会**用默认值悄悄填必需变量 —— 缺值时直接报错, 让你显式补.

## 把 server 装进中央仓库 (`install`)

`add` 在拉取远端 manifest 时也会顺手写中央仓库. 如果只想注册 server, 不动任何项目, 用 `install`:

```bash
mcpsmgr install owner/repo                  # GitHub 源 (manifest 或 README 扫描)
mcpsmgr install https://github.com/o/r
mcpsmgr install ./my-mcp.json               # 任一 agent 的 MCP JSON 配置形态
mcpsmgr install ~/workspace/my-mcp-server   # 本地项目目录
mcpsmgr install                             # 交互式手动流程
```

GitHub 来源还会同步更新 `~/.mcps-manager/bundles.json`, 让后续 `add repo` 能反查到这个仓库声明的所有 server.

## 部署到 agent (`deploy`)

```bash
cd your-project
mcpsmgr deploy             # 选要部署的中央 server
mcpsmgr deploy --refresh   # 把项目里已有 server 从中央重新刷一遍
```

`deploy` 自动检测项目里用的 agent (看 `.claude.json` / `.codex/` 等是否存在), 只写到这些 agent. 你在中央仓库改了 server 配置之后, 用 `--refresh` 让每个项目重新拉一次.

## 查看 / 移除

```bash
mcpsmgr list                  # 中央仓库
mcpsmgr list --deployed       # 当前项目接入了哪些 server
mcpsmgr remove <name>         # 从当前项目移除 (按 agent 勾选)
mcpsmgr uninstall <name>      # 从中央仓库移除
mcpsmgr update [name]         # 重新分析源文档, 更新中央定义
```

`remove` 只动项目配置; `uninstall` 移除中央条目 (并从所属 bundle 的 members 同步剔除).

## 支持的 agent

| Agent | 配置位置 | 范围 | 格式 |
|---|---|---|---|
| Claude Code | `.mcp.json` | 项目 | JSON |
| Codex | `.codex/config.toml` | 项目 | TOML |
| Cursor | `.cursor/mcp.json` | 项目 | JSON |
| Gemini CLI | `.gemini/settings.json` | 项目 | JSON |
| OpenCode | `opencode.json` | 项目 | JSON |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | 全局 | JSON |
| OpenClaw | `~/.openclaw/openclaw.json` | 全局 | JSON5 |

> **坑 —— 全局 agent.** Antigravity 和 OpenClaw 在整台机器上共用同一份配置. `add` 和 `deploy` 默认不勾选这两个, 真要改全局再手动勾.

## GitHub bundle (反查)

同一个 GitHub 仓库通过 `mcpsmgr.json` 声明多个 MCP server 时, `mcpsmgr` 会把它们记为一个 **bundle**. 首次安装后, 下列任一形态都能解析回这一组 server, 无需再走网络:

```bash
mcpsmgr add jtianling/cross-agent-teams-mcp        # owner/repo
mcpsmgr add https://github.com/jtianling/cross-agent-teams-mcp
mcpsmgr add cross-agent-teams-mcp                  # 仅 repo 名
```

Bundle 存在 `~/.mcps-manager/bundles.json`. `install` 在每次 manifest 成功落地后更新 bundle members; `uninstall <name>` 把 member 从 bundle 移除, 最后一个 member 被移除时 bundle 自动删除.

> **坑 —— repo 名冲突.** 两个不同 owner 发布了同名 repo 且都已安装时, `mcpsmgr add <basename>` 会拒绝执行并列出候选, 你需要用 `owner/repo` 形式消歧.

## 协议

MIT
