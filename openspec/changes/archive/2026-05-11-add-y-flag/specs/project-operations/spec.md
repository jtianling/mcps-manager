## ADDED Requirements

### Requirement: add 命令支持 -y unattended flag

系统 SHALL 支持 `mcpsmgr add <input> -y`, 一次性跳过本命令所有交互 prompt 与覆盖确认, 让 add 在 CI / 脚本场景里可一行运行.

`-y` 故意不暴露 `--yes` 长形, 跟 npm/yarn 的 `-y` 视觉一致; 它是聚合开关, SHALL 内部 imply `--force`. `-y` 不读任何 env var 也不在非 TTY 下自动 imply, 调用方 SHALL 显式传.

`-y` SHALL NOT 凭空填充必需输入. 必需 `variables` 与 `envVars` 缺值时 SHALL 报错并列出补齐方式 (对应 flag 或环境变量), 不偷偷使用默认值 — 防止 CI 用未配置值跑出脏数据.

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

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -a claude-code -y`, manifest 声明 `variables.token` 为 `required: true` 且无 default, 命令行未给对应 flag
- **THEN** 系统 SHALL NOT 弹 prompt, SHALL 报错 "Error: -y cannot prompt for required variable 'token'. Provide it explicitly (e.g. --port for 'port').", 退出码非零

#### Scenario: -y 遇必需 envVar 缺值 fail-fast

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -a claude-code -y`, manifest 声明 `envVars[].required = true`
- **THEN** 系统 SHALL NOT 弹 prompt, SHALL 报错 "Error: -y cannot prompt for required env var 'XXX'. Set it in the environment before running, or omit -y.", 退出码非零

#### Scenario: -y 跳过 optional envVar prompt

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code -y`, manifest 声明 `envVars[].required = false` (例如 `CROSS_AGENT_TEAMS_TOKEN`)
- **THEN** 系统 SHALL NOT 对该 envVar 弹 prompt, 该 envVar 在写入配置时被视作未提供

### Requirement: add 命令支持 --force flag (窄义)

系统 SHALL 支持 `mcpsmgr add <input> -f` / `--force`, 仅跳过"中央条目已存在, 是否覆盖" 确认, 不影响 agent 选择交互, 不影响 variables / envVars prompt.

`--force` 与 `-y` 关系: `-y` 内部 imply `--force`; 单独使用 `--force` 时只跳覆盖确认, 其它 prompt 照常.

#### Scenario: --force 跳过覆盖确认但仍交互选 agent / 填变量

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp --force`, manifest 含 2 个 server (都已存在于中央) 且有 optional envVar
- **THEN** 系统 SHALL **不弹**任一 "Overwrite?" 确认, 但 SHALL 正常 prompt agent 勾选与 optional envVar 输入

#### Scenario: -y 隐含 --force

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -a claude-code -y`, 中央已有同名 server
- **THEN** 系统行为 SHALL 与显式带 `--force` 一致, 不弹 "Overwrite?" 确认
