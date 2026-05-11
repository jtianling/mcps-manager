## MODIFIED Requirements

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
