## ADDED Requirements

### Requirement: Claude Code Adapter

系统 SHALL 提供 Claude Code 的配置适配器, 操作 `.mcp.json` 文件.

#### Scenario: 读取已有配置

- **WHEN** 项目根目录存在 `.mcp.json`
- **THEN** adapter 解析文件, 提取 `mcpServers` 下所有 MCP 服务条目

#### Scenario: 写入新服务

- **WHEN** 向 Claude Code 添加一个 MCP 服务
- **THEN** adapter 读取 `.mcp.json` (不存在则创建), 在 `mcpServers` 下添加服务条目, 格式为 `{ "type": "<transport>", "command": "<cmd>", "args": [...], "env": {...} }` 或 HTTP 格式 `{ "type": "http", "url": "...", "headers": {...} }`, 保留文件中已有的其他服务条目

#### Scenario: 同名冲突

- **WHEN** `.mcp.json` 中已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

### Requirement: Codex CLI Adapter

系统 SHALL 提供 Codex CLI 的配置适配器, 操作 `.codex/config.toml` 文件.

#### Scenario: 读取已有配置

- **WHEN** 项目中存在 `.codex/config.toml`
- **THEN** adapter 解析 TOML 文件, 提取 `[mcp_servers.*]` 下所有 MCP 服务条目

#### Scenario: 写入新服务

- **WHEN** 向 Codex CLI 添加一个 MCP 服务
- **THEN** adapter 读取 `.codex/config.toml` (不存在则创建 `.codex/` 目录和文件), 在 `[mcp_servers.<name>]` section 下添加服务配置, 格式为 `command = "...", args = [...], env = {...}`, MUST 保留文件中已有的非 MCP section 和注释

#### Scenario: 同名冲突

- **WHEN** `.codex/config.toml` 中 `[mcp_servers]` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

### Requirement: Gemini CLI Adapter

系统 SHALL 提供 Gemini CLI 的配置适配器, 操作 `.gemini/settings.json` 文件.

#### Scenario: 读取已有配置

- **WHEN** 项目中存在 `.gemini/settings.json`
- **THEN** adapter 解析文件, 提取 `mcpServers` 下所有 MCP 服务条目

#### Scenario: 写入新服务

- **WHEN** 向 Gemini CLI 添加一个 MCP 服务
- **THEN** adapter 读取 `.gemini/settings.json` (不存在则创建 `.gemini/` 目录和文件), 在 `mcpServers` 下添加服务条目, 格式为 `{ "command": "...", "args": [...], "env": {...} }`, 保留文件中已有的其他字段 (如 `mcp`, `theme` 等非 mcpServers 字段)

#### Scenario: 同名冲突

- **WHEN** `.gemini/settings.json` 中 `mcpServers` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

### Requirement: OpenCode Adapter

系统 SHALL 提供 OpenCode 的配置适配器, 操作 `opencode.json` 文件.

#### Scenario: 读取已有配置

- **WHEN** 项目根目录存在 `opencode.json`
- **THEN** adapter 解析文件, 提取 `mcp` 下所有 MCP 服务条目

#### Scenario: 写入新服务 (stdio)

- **WHEN** 向 OpenCode 添加一个 stdio 类型的 MCP 服务
- **THEN** adapter 在 `mcp` 下添加服务条目, 格式为 `{ "type": "local", "command": ["<cmd>", "<arg1>", ...], "environment": {...} }`, 注意 `command` MUST 为数组 (包含命令和参数), `env` key MUST 转换为 `environment`

#### Scenario: 写入新服务 (http)

- **WHEN** 向 OpenCode 添加一个 http 类型的 MCP 服务
- **THEN** adapter 在 `mcp` 下添加服务条目, 格式为 `{ "type": "remote", "url": "...", "headers": {...} }`

#### Scenario: 同名冲突

- **WHEN** `opencode.json` 中 `mcp` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

### Requirement: Antigravity Adapter

系统 SHALL 提供 Antigravity 的配置适配器, 操作 `~/.gemini/antigravity/mcp_config.json` (全局文件).

#### Scenario: 读取已有配置

- **WHEN** `~/.gemini/antigravity/mcp_config.json` 存在
- **THEN** adapter 解析文件, 提取 `mcpServers` 下所有 MCP 服务条目

#### Scenario: 写入新服务

- **WHEN** 向 Antigravity 添加一个 MCP 服务
- **THEN** adapter 读取 `~/.gemini/antigravity/mcp_config.json` (不存在则创建目录和文件), 在 `mcpServers` 下添加服务条目, 格式为 `{ "command": "...", "args": [...], "env": {...} }` 或 HTTP 格式 `{ "serverUrl": "...", "headers": {...} }`, 注意 HTTP 时 url key MUST 为 `serverUrl`

#### Scenario: 同名冲突

- **WHEN** 配置文件中 `mcpServers` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

### Requirement: Agent 自动检测

系统 SHALL 在项目目录中自动检测哪些 agent 的配置文件已存在.

#### Scenario: 检测项目中的 agent

- **WHEN** 系统需要确定项目使用了哪些 agent
- **THEN** 系统检查以下文件是否存在: `.mcp.json` (Claude Code), `.codex/` 目录 (Codex CLI), `.gemini/settings.json` (Gemini CLI), `opencode.json` (OpenCode); Antigravity 始终作为可选项列出 (因为仅全局配置)
