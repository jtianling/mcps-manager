## Purpose

管理中央仓库中 MCP 服务定义的添加, 移除和列出, 包括通过规则化 README 分析和本地源嗅探自动生成配置.
## Requirements
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

### Requirement: 同名服务检测

系统 SHALL 在添加服务时检测中央仓库中是否已存在同名服务.

#### Scenario: 中央仓库同名冲突

- **WHEN** 用户添加的服务名与 `~/.mcps-manager/servers/` 中已有服务同名
- **THEN** 系统报错, 提示服务已存在并建议先执行 `mcpsmgr uninstall <name>`

### Requirement: 无文档 URL 回退

系统 SHALL 支持不提供文档 URL 时的手动配置.

#### Scenario: 文档 URL 留空

- **WHEN** 用户执行 `mcpsmgr install` 不提供 source 参数
- **THEN** 系统进入交互模式, 提示用户输入 URL 或 GitHub repo, 留空则进入手动配置模式

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

### Requirement: 列出中央仓库服务

系统 SHALL 在 `mcpsmgr list` 命令 (无 `--deployed` flag) 下列出中央仓库中所有已保存的服务.

#### Scenario: 列出所有服务

- **WHEN** 用户执行 `mcpsmgr list`
- **THEN** 系统读取 `~/.mcps-manager/servers/` 下所有 JSON 文件, 展示服务名, 来源, transport 类型, 是否有 overrides

### Requirement: install 从本地目录添加

系统 SHALL 支持 `mcpsmgr install <path/to/dir>` 形态, 根据 manifest 推断配置.

#### Scenario: install 指向项目目录

- **WHEN** 用户执行 `mcpsmgr install ./my-mcp-server` 且目录存在
- **THEN** 系统 SHALL 调用本地 manifest 探测流程 (详见 `local-source-analysis`), 成功则写入中央仓库, source 标记为 `local`

#### Scenario: 路径不存在

- **WHEN** 用户提供的路径既不存在也不是合法的 `owner/repo` 模式
- **THEN** 系统 SHALL 报错 "Path does not exist: <path>", 退出码非零

### Requirement: install 从本地 JSON 文件添加

系统 SHALL 支持 `mcpsmgr install <path/to/file.json>` 形态, 对多种已知 MCP 配置形状做嗅探.

#### Scenario: install 指向单 server JSON

- **WHEN** 用户执行 `mcpsmgr install ./mcp.json` 且文件是已知形状 (ServerDefinition / mcpServers / mcp), 含单个 server
- **THEN** 系统 SHALL 按 `local-source-analysis` 的嗅探策略解析, 写入中央仓库

#### Scenario: install 指向多 server JSON

- **WHEN** 用户执行 `mcpsmgr install ./claude-code.mcp.json` 且文件中 `mcpServers` 含多个条目
- **THEN** 系统 SHALL 展示 checkbox 多选 (默认全选), 对选中的每个条目分别写入中央仓库. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 文件不是合法 JSON

- **WHEN** 文件内容不是合法 JSON
- **THEN** 系统 SHALL 报错 "File is not valid JSON: <path>"

### Requirement: 分析结果交互式确认

系统 SHALL 在规则化分析产生结果后, 展示给用户并获取确认.

#### Scenario: 用户信任分析结果

- **WHEN** 规则化分析返回配置, 且用户选择信任
- **THEN** 系统 SHALL 交互式要求用户输入 `requiredEnvVars` 中的值 (password 模式, 输入以 `*` 显示, 提示信息包含 "stored locally, never sent to servers"), 保存完整 `ServerDefinition` 到中央仓库

#### Scenario: 用户不信任分析结果

- **WHEN** 规则化分析返回配置, 但用户选择不信任
- **THEN** 系统 SHALL 询问是否改走 manual 向导; 用户确认后进入 manual 向导, 用户拒绝则退出不保存

### Requirement: server-add 交互中断优雅退出

`mcpsmgr install` 命令 SHALL 在用户按 Ctrl-C 中断任意 prompt 时正常退出, 不输出错误信息, 退出码为 0.

#### Scenario: 规则分析确认中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr install <source>` 的规则分析结果确认或环境变量输入 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不保存任何服务配置, 进程退出码为 0

#### Scenario: 手动模式中按 Ctrl-C

- **WHEN** 用户在手动配置模式的任意 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不保存任何服务配置, 进程退出码为 0

#### Scenario: 本地多 server 选择中按 Ctrl-C

- **WHEN** 用户在本地 JSON 多 server 的 checkbox 选择 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不保存任何条目, 进程退出码为 0

