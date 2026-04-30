## ADDED Requirements

### Requirement: Cursor Adapter

系统 SHALL 提供 Cursor 的配置适配器, 操作 `.cursor/mcp.json` 文件 (项目级).

#### Scenario: 读取已有配置

- **WHEN** 项目中存在 `.cursor/mcp.json`
- **THEN** adapter 解析文件, 提取 `mcpServers` 下所有 MCP 服务条目

#### Scenario: 写入新服务

- **WHEN** 向 Cursor 添加一个 MCP 服务
- **THEN** adapter 读取 `.cursor/mcp.json` (不存在则创建 `.cursor/` 目录和文件), 在 `mcpServers` 下添加服务条目, stdio 使用 env command wrapper 格式 (有 env vars 时 `command: "env"`, 否则原始 command), HTTP 使用 `{ "url": "...", "headers": {...} }` 格式 (无 `type` 字段, transport 由是否含 `command` 或 `url` 推断), 保留文件中已有的其他字段

#### Scenario: 同名冲突

- **WHEN** `.cursor/mcp.json` 中 `mcpServers` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

## MODIFIED Requirements

### Requirement: Agent 自动检测

系统 SHALL 在项目目录中自动检测哪些 agent 的配置文件已存在.

#### Scenario: 检测项目中的 agent

- **WHEN** 系统需要确定项目使用了哪些 agent
- **THEN** 系统检查以下文件是否存在: `.mcp.json` (Claude Code), `.codex/` 目录 (Codex), `.cursor/mcp.json` (Cursor), `.gemini/settings.json` (Gemini CLI), `opencode.json` (OpenCode); Antigravity 和 OpenClaw 始终作为可选项列出 (因为仅全局配置)
