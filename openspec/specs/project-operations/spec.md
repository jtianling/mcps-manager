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

入口 SHALL 先调用 source-bundle-resolver 的 `resolve(input)`. 命中 `bundle` 或 `server` 时, 系统 SHALL 直接把 bundle 的全部 `members` 或单个 server 写入用户选定的 agent, **不再拉取远端 manifest, 不再询问"中央仓库已存在, 是否覆盖"**.

只有 resolver 返回 `not-found` 且输入是 `owner/repo` / URL 形态时, 才 fallback 到现有 GitHub manifest 拉取路径; 输入是 kebab 且 resolver 返回 not-found 时, SHALL 报错 `Server not found in central repository`.

#### Scenario: input 是中央 server name (resolver 命中 server)

- **WHEN** 用户执行 `mcpsmgr add context7`, `context7` 是 `~/.mcps-manager/servers/context7.json` 的文件名
- **THEN** resolver 返回 `{ kind: "server", name: "context7" }`; 系统 SHALL 展示 agent 勾选列表, 把 `context7` 写入勾选 agent 的配置文件; 不拉远端, 不询问覆盖

#### Scenario: input 是 GitHub source 且 bundle 已存在 (resolver 命中 bundle)

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp`, 该仓库已通过 manifest 装入中央且 bundles.json 含对应条目 (members = `["cross-agent-teams", "cross-agent-teams-channel"]`)
- **THEN** resolver 返回 `{ kind: "bundle", members: [...] }`; 系统 SHALL 把全部 members 都写入选定 agent, 不拉 manifest, 不问覆盖, 单次命令在中央 servers/ 内**不发生写**

#### Scenario: input 是 repo basename 与 bundle repoName 匹配 (resolver 命中 bundle)

- **WHEN** 用户执行 `mcpsmgr add cross-agent-teams-mcp`, 中央无 `cross-agent-teams-mcp.json`, 但某些条目的 `repoName === "cross-agent-teams-mcp"` 且其 `bundleId` 指向 `git:https://github.com/jtianling/cross-agent-teams-mcp`
- **THEN** resolver 通过 repoName 反查到 bundle, 返回完整 `members`; 系统 SHALL 与"input 是 GitHub source 且 bundle 已存在"行为一致, 把全部 members 写入选定 agent

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

