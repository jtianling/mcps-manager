## MODIFIED Requirements

### Requirement: 项目添加服务

系统 SHALL 支持 `mcpsmgr add <input>` 命令, 接受两种 `<input>` 形态:

1. 中央仓库已有的 server name (kebab-case): 把该 server 添加到当前项目的 agent 配置中 (现有行为).
2. GitHub source (`owner/repo` 或完整 GitHub URL): 拉取仓库的 `mcpsmgr.json` manifest, 进入多 agent / 多 server 部署流程; 没有 manifest 时回退到 readme-analysis 单 server 流程, 安装到中央仓库 **同时** 部署到当前项目.

#### Scenario: input 是中央 server name

- **WHEN** 用户执行 `mcpsmgr add context7`, 且 `context7` 不含 `/` 不含 `://` 且符合 kebab-case 模式
- **THEN** 系统 SHALL 走现有行为, 展示 agent 勾选列表, 把 `context7` 写入勾选 agent 的配置文件

#### Scenario: input 是 GitHub source 且 manifest 命中

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp`, 且仓库根目录存在 `mcpsmgr.json`
- **THEN** 系统 SHALL 拉取并校验 manifest; 默认列出 manifest `agents` 中所有 agent 给用户 checkbox 多选 (项目检测到的 agent 默认勾选); 用户选择 agent 后, 对每个 agent 的 servers[] 把每个 server 写入中央仓库 `~/.mcps-manager/servers/<name>.json` 同时写入对应 agent 的项目配置文件; 完成后打印 prerequisites 与所选 agent 的 postInstallNotes

#### Scenario: input 是 GitHub source 但无 manifest

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp`, 但仓库根目录无 `mcpsmgr.json`
- **THEN** 系统 SHALL 输出 info "no mcpsmgr.json found, falling back to README analysis", 走 readme-analysis 单 server 流程; 抽取出的 server 写入中央仓库 **同时** 部署到当前项目检测到的 agent (项目级 agent 选择 prompt 与中央 server name flow 一致)

#### Scenario: input 是不合法 GitHub URL

- **WHEN** 用户执行 `mcpsmgr add https://gitlab.com/foo/bar` (非 github.com)
- **THEN** 系统 SHALL 报错 "Only GitHub URLs are supported for remote install. Use './path.json' for other sources or pass a central server name."

### Requirement: add 命令支持 --agent flag

系统 SHALL 支持 `mcpsmgr add <input> -a <agent-id>` (`--agent <agent-id>`), 跳过交互式 agent 选择, 直接对指定 agent 落地.

#### Scenario: -a 命中 manifest 中的 agent

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code`, manifest 含 `agents.claude-code`
- **THEN** 系统 SHALL 跳过 agent 选择 prompt, 直接对 `claude-code` 写入所有 manifest 中声明的 server entries; envVars 与 variables 仍正常 prompt; postInstallNotes 仅打印 `claude-code` 的, prerequisites 仍全打印

#### Scenario: -a 不在 manifest 中

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-repo -a antigravity`, manifest 仅含 `claude-code` 与 `codex`
- **THEN** 系统 SHALL 报错 "manifest does not declare configuration for agent 'antigravity'; available: claude-code, codex"

#### Scenario: -a 与中央 server name 一起用

- **WHEN** 用户执行 `mcpsmgr add context7 -a claude-code` 且 `context7` 是中央 server
- **THEN** 系统 SHALL 跳过 agent 选择 prompt, 直接对 `claude-code` 写入 `context7`

#### Scenario: -a 指定无效 agent id

- **WHEN** 用户执行 `mcpsmgr add foo -a unknown-agent`
- **THEN** 系统 SHALL 报错列出已知 agent id

### Requirement: add 命令支持 --port flag

系统 SHALL 支持 `mcpsmgr add <github-source> --port <number>`, 仅对 manifest flow 有效, 用于覆盖 manifest `variables.port.default`.

#### Scenario: --port 命中

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex --port 9300`, manifest 含 `variables.port`
- **THEN** 系统 SHALL 把所有 `${port}` 占位替换为 `9300` 后落地

#### Scenario: --port 但 manifest 无 variables.port

- **WHEN** 用户执行 `--port 9300` 但 manifest 没有声明 `variables.port`
- **THEN** 系统 SHALL 报错 "--port has no effect: manifest does not declare 'variables.port'"

#### Scenario: --port 用于中央 server

- **WHEN** 用户执行 `mcpsmgr add context7 --port 9300` (input 是中央 name 不是 GitHub)
- **THEN** 系统 SHALL 报错 "--port only applies to manifest-driven add (GitHub source)"
