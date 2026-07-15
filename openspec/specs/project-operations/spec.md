## Purpose

提供项目级的 MCP 服务管理操作, 包括部署, 添加, 移除, 刷新同步和状态查看.
## Requirements
### Requirement: 项目初始化

系统 SHALL 支持 `mcpsmgr deploy` 命令, 在当前项目中交互式选择 agent 和 MCP 服务.

#### Scenario: 交互式初始化

- **WHEN** 用户在项目目录执行 `mcpsmgr deploy`
- **THEN** 系统自动检测已存在的 agent 配置文件并预选 (其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中), 展示所有支持的 agent 供用户勾选, 从中央仓库列出所有已保存的 MCP 服务供用户勾选, 展示即将执行的操作预览, 确认后将选中的服务写入选中的 agent 配置文件. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 服务器选择默认状态基于目标目录检测

- **WHEN** 用户完成 agent 选择后进入服务器选择步骤
- **THEN** 系统 SHALL 读取所有已选中 agent 的现有配置, 收集已存在的 MCP 服务名称. 对于已存在于任一已选中 agent 配置中的服务, SHALL 标记为 `(detected)` 并默认选中. 对于不存在于任何已选中 agent 配置中的服务, SHALL 默认不选中.

#### Scenario: 配置读取失败降级

- **WHEN** 读取某个已选中 agent 的现有配置时发生错误 (如文件损坏)
- **THEN** 系统 SHALL 跳过该 agent 的服务检测, 继续处理其他 agent, 不阻断初始化流程

#### Scenario: 中央仓库为空

- **WHEN** 用户执行 `mcpsmgr deploy` 但 `~/.mcps-manager/servers/` 下没有任何服务
- **THEN** 系统提示中央仓库为空, 建议先使用 `mcpsmgr install` 添加服务

### Requirement: 项目添加服务

系统 SHALL 支持 `mcpsmgr add <input>` 命令. `<input>` 可以是下列三种形态之一: 中央 server name (kebab-case), GitHub source (`owner/repo` 或完整 GitHub URL), 或仓库 repo basename (kebab, 与已安装仓库的 repoName 字段精准匹配).

入口 SHALL 先调用 source-bundle-resolver 的 `resolve(input)`. 命中 `server` 时, 系统 SHALL 直接把该 server 写入用户选定的 agent, 不拉取远端 manifest, 不询问"中央仓库已存在, 是否覆盖". 命中 `bundle` 时, 系统 SHALL 先执行 manifest 刷新检测 (见 "add 命令 bundle 命中时 manifest 刷新检测"); 最终落在旧定义路径时, 把 bundle 的全部 `members` 写入选定 agent, 不询问覆盖.

只有 resolver 返回 `not-found` 且输入是 `owner/repo` / URL 形态时, 才 fallback 到现有 GitHub manifest 拉取路径; 输入是 kebab 且 resolver 返回 not-found 时, SHALL 报错 `Server not found in central repository`.

#### Scenario: input 是中央 server name (resolver 命中 server)

- **WHEN** 用户执行 `mcpsmgr add context7`, `context7` 是 `~/.mcps-manager/servers/context7.json` 的文件名
- **THEN** resolver 返回 `{ kind: "server", name: "context7" }`; 系统 SHALL 展示 agent 勾选列表, 把 `context7` 写入勾选 agent 的配置文件; 不拉远端, 不询问覆盖

#### Scenario: input 是 GitHub source 且 bundle 已存在 (resolver 命中 bundle)

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp`, 该仓库已通过 manifest 装入中央且 bundles.json 含对应条目 (members = `["cross-agent-teams", "cross-agent-teams-channel"]`)
- **THEN** resolver 返回 `{ kind: "bundle", members: [...] }`; 系统 SHALL 先执行 manifest 刷新检测; 无差异 / fetch 失败 / 用户拒绝覆盖时, 把全部 members 按旧定义写入选定 agent, 不问中央覆盖, 单次命令在中央 servers/ 内**不发生写**

#### Scenario: input 是 repo basename 与 bundle repoName 匹配 (resolver 命中 bundle)

- **WHEN** 用户执行 `mcpsmgr add cross-agent-teams-mcp`, 中央无 `cross-agent-teams-mcp.json`, 但某些条目的 `repoName === "cross-agent-teams-mcp"` 且其 `bundleId` 指向 `git:https://github.com/jtianling/cross-agent-teams-mcp`
- **THEN** resolver 通过 repoName 反查到 bundle, 返回完整 `members`; 系统 SHALL 与"input 是 GitHub source 且 bundle 已存在"行为一致 (含 manifest 刷新检测)

#### Scenario: input 是 GitHub source 且 manifest 命中 (首次安装)

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp`, 仓库根目录存在 `mcpsmgr.json`, 但 bundles.json 中尚无对应条目
- **THEN** resolver 返回 `{ kind: "not-found", inputForm: "owner-repo" }`; 系统 SHALL fallback 到当前 manifest 拉取路径, 写入每个 server 时附 `repoName` 与 `bundleId`, 并 upsert bundle 条目

#### Scenario: input 是 GitHub source 但无 manifest

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-old-repo`, 仓库根目录无 `mcpsmgr.json` 且 bundles.json 中无对应条目
- **THEN** 系统 SHALL 输出 info "no mcpsmgr.json found, falling back to README analysis", 走 readme-analysis 单 server 流程; 抽取出的 server 写入中央 (含 `repoName` / `bundleId` 字段) **同时** 部署到当前项目检测到的 agent

#### Scenario: input 是 kebab 且 resolver 完全 not-found

- **WHEN** 用户执行 `mcpsmgr add definitely-not-installed`, 中央既无同名 server 也无任何条目的 `repoName === "definitely-not-installed"`
- **THEN** 系统 SHALL 报错 `Server "definitely-not-installed" not found in central repository. Use "mcpsmgr install" to add it.`, 退出码非零

#### Scenario: input 是不合法 GitHub URL

- **WHEN** 用户执行 `mcpsmgr add https://gitlab.com/foo/bar` (非 github.com)
- **THEN** 系统 SHALL 报错 "Only GitHub URLs are supported for remote install. Use './path.json' for other sources or pass a central server name."

#### Scenario: repoName 有歧义 (多 owner 同名仓库)

- **WHEN** 用户执行 `mcpsmgr add foo`, 中央存在两个不同 owner 的同名仓库 (`a/foo` 与 `b/foo`), 两边 `repoName` 都等于 `foo`
- **THEN** 系统 SHALL 报错 `Ambiguous bareword "foo": matches multiple repos (a/foo, b/foo). Use owner/repo form to disambiguate.`, 退出码非零

### Requirement: 项目移除服务

系统 SHALL 支持 `mcpsmgr remove <server-name>` 命令, 从当前项目的 agent 配置中移除单个 MCP 服务配置.

#### Scenario: 从多个 agent 移除

- **WHEN** 用户执行 `mcpsmgr remove brave-search`
- **THEN** 系统列出包含该服务的所有 agent 配置, 供用户勾选要移除的 (其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中), 从勾选的 agent 配置文件中删除该服务条目, 保留文件中的其他内容. 未勾选的 agent SHALL NOT 被删除任何 MCP 配置. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 无 agent 包含该服务

- **WHEN** 用户执行 `mcpsmgr remove nonexistent` 但没有任何 agent 配置包含该服务
- **THEN** 系统提示未在任何 agent 配置中找到该服务

#### Scenario: 取消选中 agent 不删除 MCP

- **WHEN** 用户在 remove 交互中取消选中某个 agent
- **THEN** 系统 SHALL NOT 删除该 agent 中的任何 MCP 配置, 仅跳过该 agent

### Requirement: 同步中央仓库变更

系统 SHALL 支持 `mcpsmgr deploy --refresh` 命令, 将中央仓库的服务配置同步到当前项目的 agent 配置文件.

#### Scenario: 同步更新

- **WHEN** 用户修改了中央仓库中的服务配置 (如更新了 API key) 后执行 `mcpsmgr deploy --refresh`
- **THEN** 系统读取各 agent 配置文件中已有的 MCP 服务, 与中央仓库比对, 展示变更预览, 用户确认后更新 agent 配置文件中对应服务的配置

#### Scenario: 同名冲突处理

- **WHEN** sync 过程中发现某个 agent 配置中的服务名与中央仓库同名但非 mcpsmgr 管理 (用户手动添加的)
- **THEN** 系统报告冲突, 跳过该服务在该 agent 的同步

### Requirement: 列出项目 MCP 状态

系统 SHALL 支持 `mcpsmgr list --deployed` 命令, 展示当前项目各 agent 的 MCP 服务状态矩阵.

#### Scenario: 状态矩阵展示

- **WHEN** 用户在项目目录执行 `mcpsmgr list --deployed`
- **THEN** 系统扫描所有 agent 的实际配置文件, 解析出已配置的 MCP 服务, 以表格形式展示 (行: 服务名, 列: agent 名, 值: 是否存在及 transport 类型)

#### Scenario: 无 agent 配置文件

- **WHEN** 项目中没有任何 agent 配置文件且用户执行 `mcpsmgr list --deployed`
- **THEN** 系统提示未检测到任何 agent 配置, 建议执行 `mcpsmgr deploy`

### Requirement: 交互中断优雅退出

所有项目级交互式命令 (deploy, add, remove) SHALL 在用户按 Ctrl-C 中断 prompt 时正常退出, 不输出错误信息, 退出码为 0.

#### Scenario: deploy 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr deploy` 的任意 prompt 步骤中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: deploy --refresh 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr deploy --refresh` 的确认 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: add 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr add <server>` 的 agent 选择 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: remove 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr remove <server>` 的 agent 选择 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

### Requirement: deploy 命令中取消勾选已检测服务触发删除

系统 SHALL 在 `mcpsmgr deploy` 中, 当用户取消勾选已检测到的 MCP 服务时, 将其视为删除意图, 在操作计划中展示并在确认后执行删除.

#### Scenario: 取消勾选已检测服务

- **WHEN** 用户在 `mcpsmgr deploy` 的服务选择步骤中, 取消勾选一个已被检测到 (标记为 `(detected)`) 的服务
- **THEN** 系统 SHALL 在操作计划中以 `- <server-name>` 格式展示该服务将被删除, 并在用户确认后, 从对应 agent 配置中移除该服务

#### Scenario: 仅从包含该服务的 agent 中删除

- **WHEN** 用户取消勾选一个已检测服务, 且多个已选 agent 中只有部分包含该服务
- **THEN** 系统 SHALL 仅从实际包含该服务的 agent 配置中执行删除, 不影响不包含该服务的 agent

### Requirement: 项目初始化空仓库提示

系统 SHALL 在中央仓库为空时给出正确的提示命令.

#### Scenario: 中央仓库为空

- **WHEN** 用户执行 `mcpsmgr deploy` 但 `~/.mcps-manager/servers/` 下没有任何服务
- **THEN** 系统提示中央仓库为空, 建议先使用 `mcpsmgr install` 添加服务

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

### Requirement: add 命令支持 --force flag (窄义)

系统 SHALL 支持 `mcpsmgr add <input> -f` / `--force`, 仅跳过"中央条目已存在, 是否覆盖" 确认, 不影响 agent 选择交互, 不影响 variables / envVars prompt.

`--force` 与 `-y` 关系: `-y` 内部 imply `--force`; 单独使用 `--force` 时只跳覆盖确认, 其它 prompt 照常.

#### Scenario: --force 跳过覆盖确认但仍交互选 agent / 填变量

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp --force`, manifest 含 2 个 server (都已存在于中央) 且有 optional envVar
- **THEN** 系统 SHALL **不弹**任一 "Overwrite?" 确认, 但 SHALL 正常 prompt agent 勾选与 optional envVar 输入

#### Scenario: -y 隐含 --force

- **WHEN** 用户执行 `mcpsmgr add jtianling/some-mcp -a claude-code -y`, 中央已有同名 server
- **THEN** 系统行为 SHALL 与显式带 `--force` 一致, 不弹 "Overwrite?" 确认

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

### Requirement: add 命令支持 --global flag

系统 SHALL 支持 `mcpsmgr add <input> --global`, 把所选 agent 的配置写到该 agent 的全局配置位置而非项目级位置. 仅声明了全局写入能力 (`globalDir()`) 且本身非全局 (`isGlobal !== true`) 的 adapter 支持 `--global`; 目前为 codex (`~/.codex/config.toml`) 与 opencode (`~/.config/opencode/opencode.json`). 中央仓库条目与 bundle 记录不受 `--global` 影响, 照常写入.

`--global` 对 central / bundle / manifest 三条 add 路径 SHALL 一致生效, 仅改变写入 agent 配置的目标目录.

#### Scenario: --global 写 codex 全局配置

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex --global`
- **THEN** 系统 SHALL 把 server 写入 `~/.codex/config.toml` 的 `[mcp_servers.*]`, 项目目录下 SHALL NOT 产生 `.codex/config.toml`

#### Scenario: --global 写 opencode 全局配置

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a opencode --global`
- **THEN** 系统 SHALL 把 server 写入 `~/.config/opencode/opencode.json` 的 `mcp` 块, 项目目录下 SHALL NOT 产生 `opencode.json`

#### Scenario: --global 用于不支持全局写入的 agent

- **WHEN** 用户执行 `mcpsmgr add context7 -a gemini-cli --global`
- **THEN** 系统 SHALL 报错说明该 agent 不支持 `--global`, 退出码非零, 不写任何 agent 配置

#### Scenario: --global 用于本身已是全局的 agent

- **WHEN** 用户执行 `mcpsmgr add context7 -a antigravity --global` (antigravity 的配置本身就是全局文件)
- **THEN** 系统 SHALL 报错说明该 agent 配置本身即全局、无需 `--global`, 退出码非零

### Requirement: add 命令 envVar 值支持非交互来源

系统 SHALL 支持 `mcpsmgr add <github-source> --var NAME=VALUE` (可重复), 仅对 manifest flow 有效, 为 manifest `envVars` 与 `variables` 提供非交互值. envVar 取值优先级 SHALL 为: `--var` > `process.env[name]` > 交互 prompt. `variables` 取值优先级 SHALL 为: 专用 flag (如 `--port`) > `--var` > default > 交互 prompt (required 且无值时); `variables` 不读 `process.env`.

命中 `--var` 或 `process.env` 时 SHALL NOT prompt (交互与 `-y` 模式一致), 且 SHALL 打印一行来源提示 (secret 值不回显).

`--var` 的 NAME 不属于 manifest `envVars[].name` 亦不属于 `variables` key 时, 系统 SHALL 报错并列出可用名字, 退出码非零. `--var` 用于 central server 路径时 SHALL 报错, 与 `--port` 同类校验; bundle 命中路径因 manifest 刷新检测可能进入 manifest flow, SHALL NOT 在入口预先拒绝 `--var`, 但最终落在旧定义路径时 SHALL 报同样的错误 (flag 仅对 manifest 生效). VALUE 允许包含 `=` (按第一个 `=` 切分).

#### Scenario: --var 提供 optional envVar

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex -y --var CROSS_AGENT_TEAMS_MCP_TOKEN=abc123`, manifest 声明该 envVar 为 optional
- **THEN** 系统 SHALL 使用 `abc123` 作为该 envVar 的值, 不 prompt, 打印来源提示且不回显值

#### Scenario: process.env 提供 optional envVar

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex -y`, 未传 `--var`, 进程环境存在 `CROSS_AGENT_TEAMS_MCP_TOKEN=abc123`
- **THEN** 系统 SHALL 使用环境值 `abc123`, 不 prompt

#### Scenario: --var 覆盖 process.env

- **WHEN** `--var FOO_TOKEN=flagval` 与 `process.env.FOO_TOKEN=envval` 同时存在
- **THEN** 系统 SHALL 使用 `flagval`

#### Scenario: --var 用于 bundle 命中且最终落在旧定义路径

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp --var FOO=bar`, bundle 命中但 manifest fetch 失败 (或用户拒绝覆盖)
- **THEN** 系统 SHALL 报错 "--var only applies to manifest-driven add (GitHub source)", 退出码非零, 不写任何 agent 配置

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

### Requirement: add 命令 bundle 命中时 manifest 刷新检测

resolver 命中 `bundle` 时, 系统 SHALL 先用 `bundle.url` 解析 GitHub ref 并尝试重新 fetch 源仓库 `mcpsmgr.json`, 检测其应用结果与中央 store 旧定义是否有差异, 有差异时提示用户选择覆盖或沿用旧定义.

流程约束:

- agent 选择 (--agent / -y / 交互勾选) SHALL 在刷新检测之前完成一次, 三条后续路径 (diff 预览, manifest 覆盖安装, 旧定义写入) 复用同一选择结果, SHALL NOT 二次询问 agent.
- diff 预览 SHALL 为纯非交互计算: variables 取 manifest 默认值 + `--var` + `--port`, envVars 只取 `--var` 与 `process.env`, SHALL NOT 弹出任何交互提问.
- diff 判定: 选中 agents 的 manifest 应用结果与旧路径写入内容比较 — (a) server 名集合 (manifest per-agent 结果 vs bundle 全部 members) 不同, 或 (b) 交集内任一 server 的 default 配置深比较不同, 即为有差异. 预览计算因 required 变量缺值抛错时 SHALL 同样按有差异处理.
- 用户同意覆盖后, 系统 SHALL 走完整 manifest 安装流程, 产出 (per-agent server 筛选, `bearerTokenEnvVar`, env 交互, prerequisites / postInstallNotes 输出) SHALL 与 bundle 不存在时的 fresh manifest 安装一致, 并刷新中央 store 定义与 bundle 记录.
- 用户拒绝覆盖, 或 fetch 失败 (网络错误 / 404 / manifest 无效), 或无差异时, 系统 SHALL 走既有 bundle 旧定义路径; fetch 失败与无差异场景 SHALL NOT 打印错误或提示 (离线为正常场景).
- `-y` SHALL 视为同意覆盖, 不提问.

#### Scenario: 有差异且用户同意覆盖

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex`, bundle 已存在但源仓库 manifest 已演进 (codex 段仅含 `cross-agent-teams` 且声明 Bearer token envVar), diff 预览检出差异, 用户在提示中选择覆盖
- **THEN** 系统 SHALL 按新 manifest 只把 `cross-agent-teams` (含 `bearer_token_env_var`) 写入 Codex, 不写 `cross-agent-teams-channel`; 中央 store 中 `cross-agent-teams` 定义 SHALL 被刷新为含 `bearerTokenEnvVar` 的新配置

#### Scenario: 有差异但用户拒绝覆盖

- **WHEN** 同上场景, 用户在提示中选择不覆盖
- **THEN** 系统 SHALL 把 bundle 全部 members 按中央 store 旧定义写入 Codex (与修改前行为一致), 中央 store 与 bundle 记录 SHALL NOT 发生任何写入

#### Scenario: 无差异时不提示

- **WHEN** bundle 命中且 fetch 成功, diff 预览结果与旧定义完全一致
- **THEN** 系统 SHALL 直接走旧定义路径写入选定 agent, SHALL NOT 出现覆盖提示

#### Scenario: fetch 失败静默回退 (离线可用)

- **WHEN** bundle 命中但 manifest fetch 抛网络错误 (或返回 404 / manifest 校验失败)
- **THEN** 系统 SHALL 静默走旧定义路径, 输出与修改前完全一致, 不打印 fetch 错误

#### Scenario: -y 视为同意覆盖

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex -y`, diff 预览检出差异
- **THEN** 系统 SHALL 不提问, 直接按新 manifest 覆盖安装

#### Scenario: 裸 repoName 输入同样享受刷新检测

- **WHEN** 用户执行 `mcpsmgr add cross-agent-teams-mcp` (repoName 反查命中 bundle), 源仓库 manifest 有更新
- **THEN** 系统 SHALL 与 GitHub source 输入形态行为一致, 出现覆盖提示

#### Scenario: 部分 agent 覆盖不挤掉其他 bundle 成员

- **WHEN** bundle members 为 `["cross-agent-teams", "cross-agent-teams-channel"]`, 用户仅对 codex 覆盖安装, 新 manifest codex 段只产出 `cross-agent-teams`
- **THEN** upsert 后 bundle 记录的 members SHALL 仍包含 `cross-agent-teams-channel` (与既有 members 求并集), 其中央 store 定义 SHALL 保留
