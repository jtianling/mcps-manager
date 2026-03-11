## Purpose

管理中央仓库中 MCP 服务定义的添加, 移除和列出, 包括通过 GLM5 分析文档自动生成配置.

## Requirements

### Requirement: 通过 URL 添加 MCP 服务

系统 SHALL 支持 `mcpsmgr server add <url-or-repo>` 命令, 通过 URL 或 GitHub `owner/repo` 简写添加 MCP 服务到中央仓库.

#### Scenario: 使用 GitHub 简写添加

- **WHEN** 用户执行 `mcpsmgr server add anthropics/mcp-brave-search`
- **THEN** 系统将 `anthropics/mcp-brave-search` 扩展为 `https://github.com/anthropics/mcp-brave-search`, 优先获取 README.md 内容, 调用 GLM5 分析文档, 提取服务名和配置, 展示分析结果供用户确认

#### Scenario: 使用完整 URL 添加

- **WHEN** 用户执行 `mcpsmgr server add https://docs.bigmodel.cn/cn/coding-plan/mcp/search-mcp-server`
- **THEN** 系统直接将 URL 传递给 GLM5 分析, 提取服务名和配置

#### Scenario: 不支持的输入格式

- **WHEN** 用户执行 `mcpsmgr server add @scope/package` 或 `mcpsmgr server add bare-name`
- **THEN** 系统报错, 提示需要提供 URL 或 `owner/repo` 格式

### Requirement: 同名服务检测

系统 SHALL 在添加服务时检测中央仓库中是否已存在同名服务.

#### Scenario: 中央仓库同名冲突

- **WHEN** 用户添加的服务名与 `~/.mcps-manager/servers/` 中已有服务同名
- **THEN** 系统报错, 提示服务已存在并建议先执行 `mcpsmgr server remove <name>`

### Requirement: GLM5 分析结果确认

系统 SHALL 展示 GLM5 的分析结果, 让用户选择是否信任.

#### Scenario: 用户信任分析结果

- **WHEN** GLM5 返回分析结果且用户选择信任
- **THEN** 系统使用分析结果中的配置, 交互式要求用户输入 requiredEnvVars 中的值 (每次按键以 `*` 显示, 支持粘贴), 提示信息中 SHALL 包含安全说明 "stored locally, never sent to servers", 输入的值不会传递给 GLM5 或其他 LLM, 直接按已生成的配置保存到中央仓库

#### Scenario: 用户不信任分析结果

- **WHEN** GLM5 返回分析结果且用户选择不信任
- **THEN** 系统回退到手动配置模式, 要求用户逐项输入 transport, command, args, env 等信息

### Requirement: 无文档 URL 回退

系统 SHALL 支持不提供文档 URL 时的手动配置.

#### Scenario: 文档 URL 留空

- **WHEN** 用户在添加流程中文档 URL 留空
- **THEN** 系统进入手动配置模式, 不调用 GLM5, 不生成 overrides, 仅保存 default 配置

### Requirement: 移除 MCP 服务

系统 SHALL 支持 `mcpsmgr server remove <name>` 命令, 从中央仓库删除服务定义.

#### Scenario: 成功移除

- **WHEN** 用户执行 `mcpsmgr server remove brave-search` 且服务存在
- **THEN** 系统删除 `~/.mcps-manager/servers/brave-search.json`

#### Scenario: 服务不存在

- **WHEN** 用户执行 `mcpsmgr server remove nonexistent`
- **THEN** 系统报错, 提示服务不存在

### Requirement: 列出中央仓库服务

系统 SHALL 支持 `mcpsmgr server list` 命令, 列出中央仓库中所有已保存的服务.

#### Scenario: 列出所有服务

- **WHEN** 用户执行 `mcpsmgr server list`
- **THEN** 系统读取 `~/.mcps-manager/servers/` 下所有 JSON 文件, 展示服务名, 来源, transport 类型, 是否有 overrides

### Requirement: server-add 交互中断优雅退出

`mcpsmgr server add` 命令 SHALL 在用户按 Ctrl-C 中断任意 prompt 时正常退出, 不输出错误信息, 退出码为 0.

#### Scenario: 自动模式中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr server add <url>` 的 GLM 分析确认或环境变量输入 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不保存任何服务配置, 进程退出码为 0

#### Scenario: 手动模式中按 Ctrl-C

- **WHEN** 用户在手动配置模式的任意 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不保存任何服务配置, 进程退出码为 0
