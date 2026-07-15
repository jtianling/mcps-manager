# Delta: project-operations (add-bundle-manifest-refresh)

## ADDED Requirements

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

## MODIFIED Requirements

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
