## ADDED Requirements

### Requirement: add 命令支持 --global flag

系统 SHALL 支持 `mcpsmgr add <input> --global`, 把所选 agent 的配置写到该 agent 的全局配置位置而非项目级位置. 仅声明了全局写入能力 (`globalDir()`) 且本身非全局 (`isGlobal !== true`) 的 adapter 支持 `--global`; 目前仅 codex (`~/.codex/config.toml`). 中央仓库条目与 bundle 记录不受 `--global` 影响, 照常写入.

`--global` 对 central / bundle / manifest 三条 add 路径 SHALL 一致生效, 仅改变写入 agent 配置的目标目录.

#### Scenario: --global 写 codex 全局配置

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex --global`
- **THEN** 系统 SHALL 把 server 写入 `~/.codex/config.toml` 的 `[mcp_servers.*]`, 项目目录下 SHALL NOT 产生 `.codex/config.toml`

#### Scenario: --global 用于不支持全局写入的 agent

- **WHEN** 用户执行 `mcpsmgr add context7 -a opencode --global`
- **THEN** 系统 SHALL 报错说明该 agent 不支持 `--global`, 退出码非零, 不写任何 agent 配置

#### Scenario: --global 用于本身已是全局的 agent

- **WHEN** 用户执行 `mcpsmgr add context7 -a antigravity --global` (antigravity 的配置本身就是全局文件)
- **THEN** 系统 SHALL 报错说明该 agent 配置本身即全局、无需 `--global`, 退出码非零

### Requirement: add 命令 envVar 值支持非交互来源

系统 SHALL 支持 `mcpsmgr add <github-source> --var NAME=VALUE` (可重复), 仅对 manifest flow 有效, 为 manifest `envVars` 与 `variables` 提供非交互值. envVar 取值优先级 SHALL 为: `--var` > `process.env[name]` > 交互 prompt. `variables` 取值优先级 SHALL 为: 专用 flag (如 `--port`) > `--var` > default > 交互 prompt (required 且无值时); `variables` 不读 `process.env`.

命中 `--var` 或 `process.env` 时 SHALL NOT prompt (交互与 `-y` 模式一致), 且 SHALL 打印一行来源提示 (secret 值不回显).

`--var` 的 NAME 不属于 manifest `envVars[].name` 亦不属于 `variables` key 时, 系统 SHALL 报错并列出可用名字, 退出码非零. `--var` 用于非 manifest 路径 (central / bundle) 时 SHALL 报错, 与 `--port` 同类校验. VALUE 允许包含 `=` (按第一个 `=` 切分).

#### Scenario: --var 提供 optional envVar

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex -y --var CROSS_AGENT_TEAMS_MCP_TOKEN=abc123`, manifest 声明该 envVar 为 optional
- **THEN** 系统 SHALL 使用 `abc123` 作为该 envVar 的值, 不 prompt, 打印来源提示且不回显值

#### Scenario: process.env 提供 optional envVar

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex -y`, 未传 `--var`, 进程环境存在 `CROSS_AGENT_TEAMS_MCP_TOKEN=abc123`
- **THEN** 系统 SHALL 使用环境值 `abc123`, 不 prompt

#### Scenario: --var 覆盖 process.env

- **WHEN** `--var FOO_TOKEN=flagval` 与 `process.env.FOO_TOKEN=envval` 同时存在
- **THEN** 系统 SHALL 使用 `flagval`

#### Scenario: 交互模式命中非交互来源时不 prompt

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp` (无 `-y`), 进程环境存在该 envVar
- **THEN** 系统 SHALL 直接使用环境值, SHALL NOT 弹该 envVar 的 prompt (agent 勾选等其他交互照常)

#### Scenario: --var NAME 未在 manifest 声明

- **WHEN** 用户执行 `--var TYPO_NAME=x`, manifest 的 envVars 与 variables 均无 `TYPO_NAME`
- **THEN** 系统 SHALL 报错并列出 manifest 声明的可用名字, 退出码非零

#### Scenario: --var 用于中央 server

- **WHEN** 用户执行 `mcpsmgr add context7 --var FOO=bar` (input 是中央 name 不是 GitHub)
- **THEN** 系统 SHALL 报错 `--var` 仅适用于 manifest-driven add, 退出码非零

#### Scenario: --var 提供 required variable

- **WHEN** manifest 声明 `variables.token` 为 `required: true` 且无 default, 用户执行 `-y --var token=xyz`
- **THEN** 系统 SHALL 使用 `xyz`, 不报错不 prompt

## MODIFIED Requirements

### Requirement: add 命令支持 -y unattended flag

系统 SHALL 支持 `mcpsmgr add <input> -y`, 一次性跳过本命令所有交互 prompt 与覆盖确认, 让 add 在 CI / 脚本场景里可一行运行.

`-y` 故意不暴露 `--yes` 长形, 跟 npm/yarn 的 `-y` 视觉一致; 它是聚合开关, SHALL 内部 imply `--force`. `-y` flag 本身不从 env var 推断, 也不在非 TTY 下自动 imply, 调用方 SHALL 显式传. (envVar **值** 的非交互来源 `--var` / `process.env` 与 `-y` 无关, 见 "add 命令 envVar 值支持非交互来源".)

`-y` SHALL NOT 凭空填充必需输入. 必需 `variables` 与 `envVars` 在所有来源 (专用 flag, `--var`, `process.env`) 都缺值时 SHALL 报错并列出补齐方式, 不偷偷使用默认值 — 防止 CI 用未配置值跑出脏数据.

#### Scenario: -y 跳过单一覆盖确认

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -a claude-code -y`, manifest 含 1 个 server, 该 server 已存在于中央
- **THEN** 系统 SHALL 直接写中央条目并部署到 claude-code, **不弹**"Server xxx already exists. Overwrite?" 确认

#### Scenario: -y 跳过多 server 仓库的连续覆盖确认

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code -y`, manifest 含 2 个 server, 两个都已存在于中央
- **THEN** 系统 SHALL **不弹任何**"Overwrite?" 确认, 直接覆盖 2 个中央条目并部署到 claude-code

#### Scenario: -y 无 --agent 时自动选 detected agent (central 流)

- **WHEN** 用户执行 `mcpsmgr add context7 -y`, 项目检测到 claude-code 与 codex
- **THEN** 系统 SHALL 跳过 agent 勾选 prompt, 把 context7 同时写入 claude-code 与 codex 配置

#### Scenario: -y 无 --agent 时自动选 declared ∩ detected (manifest 流)

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -y`, 项目检测到 claude-code 与 antigravity, manifest 仅 declare claude-code 与 codex
- **THEN** 系统 SHALL 跳过 agent 勾选 prompt, 只对交集 (`claude-code`) 写入

#### Scenario: -y 检测不到任何匹配 agent (central / bundle 流)

- **WHEN** 用户执行 `mcpsmgr add context7 -y`, 项目未检测到任何 agent 且未传 `--agent`
- **THEN** 系统 SHALL 报错 "Error: -y requires either --agent or at least one detected agent in the project.", 退出码非零

#### Scenario: -y 检测不到匹配 declared agent (manifest 流)

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -y`, 项目检测到 cursor 但 manifest 仅 declare claude-code 与 codex
- **THEN** 系统 SHALL 报错 "Error: -y requires --agent when no manifest agent matches detected agents in the project. Manifest declares: claude-code, codex.", 退出码非零

#### Scenario: -y 遇必需 variable 缺值 fail-fast

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -a claude-code -y`, manifest 声明 `variables.token` 为 `required: true` 且无 default, 命令行未给对应 flag 也未给 `--var token=...`
- **THEN** 系统 SHALL NOT 弹 prompt, SHALL 报错 "Error: -y cannot prompt for required variable 'token'. Provide it explicitly (e.g. --port for 'port', or --var token=...).", 退出码非零

#### Scenario: -y 遇必需 envVar 全来源缺值 fail-fast

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -a claude-code -y`, manifest 声明 `envVars[].required = true`, 未传 `--var` 且进程环境无该变量
- **THEN** 系统 SHALL NOT 弹 prompt, SHALL 报错 "Error: -y cannot prompt for required env var 'XXX'. Set it in the environment before running, or omit -y.", 退出码非零

#### Scenario: -y 遇必需 envVar 有环境值时通过

- **WHEN** 同上, 但进程环境存在该 envVar 的非空值
- **THEN** 系统 SHALL 使用环境值继续, 不报错不 prompt

#### Scenario: -y 跳过 optional envVar prompt

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code -y`, manifest 声明 `envVars[].required = false` (例如 `CROSS_AGENT_TEAMS_MCP_TOKEN`), 未传 `--var` 且进程环境无该变量
- **THEN** 系统 SHALL NOT 对该 envVar 弹 prompt, 该 envVar 在写入配置时被视作未提供

#### Scenario: -y 下 optional envVar 吃非交互来源

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex -y`, manifest 声明 optional envVar, 进程环境存在该变量的非空值
- **THEN** 系统 SHALL 使用该值 (等同交互模式下用户输入了它), 不 prompt
