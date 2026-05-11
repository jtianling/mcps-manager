## MODIFIED Requirements

### Requirement: 通过 URL 添加 MCP 服务

系统 SHALL 支持 `mcpsmgr install <url-or-repo>` 命令, 通过 GitHub URL 或 `owner/repo` 简写添加 MCP 服务到中央仓库, 使用规则化的 README 分析或 manifest 解析抽取配置. 写入中央时, 系统 SHALL 同时维护对应的 bundle 条目, 让后续的 `add` 命令可以通过 source-bundle-resolver 命中.

#### Scenario: 使用 GitHub 简写添加

- **WHEN** 用户执行 `mcpsmgr install anthropics/mcp-brave-search`
- **THEN** 系统 SHALL 将 `anthropics/mcp-brave-search` 视为 GitHub 仓库, 拉取其 README (raw 首选, gh 降级), 执行规则化分析 (P1-P4 优先级), 展示抽取结果供用户确认

#### Scenario: 使用完整 GitHub URL 添加

- **WHEN** 用户执行 `mcpsmgr install https://github.com/anthropics/mcp-brave-search[/blob/main/README.md]`
- **THEN** 系统 SHALL 归一化为 `anthropics/mcp-brave-search`, 走与简写相同的流程

#### Scenario: 非 GitHub URL 拒绝

- **WHEN** 用户执行 `mcpsmgr install https://docs.example.com/mcp-server` (非 `github.com` 主机)
- **THEN** 系统 SHALL 报错提示 "Only GitHub URLs are supported for remote install. Use `./path.json` for other sources.", 退出码非零

#### Scenario: 不支持的输入格式

- **WHEN** 用户执行 `mcpsmgr install @scope/package` 或 `mcpsmgr install bare-name` (非 URL, 非 owner/repo, 非本地路径)
- **THEN** 系统 SHALL 报错, 提示需要提供 GitHub URL, `owner/repo`, 或本地路径

#### Scenario: install 写入 server 时附带 source 元数据

- **WHEN** 通过 GitHub 源 (manifest 路径或 README fallback) 写入任一 `~/.mcps-manager/servers/<name>.json`
- **THEN** 文件内容 SHALL 包含 `repoName` (来自 `normalizeGitUrl` 的 repo basename) 与 `bundleId` (`"git:" + normalizedUrl`); 本地路径来源的 install SHALL NOT 写入这两个字段

#### Scenario: install 同步 upsert bundle

- **WHEN** 一次 GitHub install 完成所有 server 写入
- **THEN** 系统 SHALL 调用 `upsertBundle(bundleId, { url, members: [本次涉及的全部 server name], selectionMode: "all" })` 把 bundle 信息写入 `~/.mcps-manager/bundles.json`; 已存在的 bundle 条目 `members` SHALL 被替换为本次安装的完整列表

### Requirement: 移除 MCP 服务

系统 SHALL 支持 `mcpsmgr uninstall <name>` 命令, 从中央仓库删除服务定义, 同时同步维护对应 bundle 的 `members` 字段.

#### Scenario: 成功移除 (server 不属于任何 bundle)

- **WHEN** 用户执行 `mcpsmgr uninstall brave-search` 且服务存在但 `bundleId` 字段缺失
- **THEN** 系统删除 `~/.mcps-manager/servers/brave-search.json`; 不触及 bundles.json

#### Scenario: 成功移除 (server 属于某 bundle, 还有其他 members)

- **WHEN** 用户执行 `mcpsmgr uninstall cross-agent-teams-channel`, 该 server `bundleId` 指向某 bundle, 且 bundle 的 `members` 还包含其他 server (例如 `cross-agent-teams`)
- **THEN** 系统 SHALL 删除 server 文件, 同时从 bundle 的 `members` 中移除 `cross-agent-teams-channel`, 刷新 `updatedAt`; bundle 条目保留

#### Scenario: 成功移除 (bundle 最后一个 member)

- **WHEN** 用户执行 `mcpsmgr uninstall cross-agent-teams`, 该 server 是其 bundle 的最后一个 member
- **THEN** 系统 SHALL 删除 server 文件, 同时从 `bundles.json` 删除该 bundle 条目

#### Scenario: 服务不存在

- **WHEN** 用户执行 `mcpsmgr uninstall nonexistent`
- **THEN** 系统报错, 提示服务不存在
