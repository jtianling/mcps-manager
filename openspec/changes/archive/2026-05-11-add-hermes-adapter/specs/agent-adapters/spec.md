## ADDED Requirements

### Requirement: Hermes Adapter

系统 SHALL 提供 NousResearch Hermes 的配置适配器, 操作 `~/.hermes/config.yaml` (全局 YAML 文件). MCP 服务配置 SHALL 位于顶层 `mcp_servers` 字段 (snake_case, 区别于其他 adapter 的 `mcpServers`). Adapter SHALL 使用原生 env mapping (native-env 策略), 不使用 `env` command wrapper. HTTP 配置 SHALL 直接写 `url` / `headers`, 无 `type` 字段, transport 由是否含 `command` 或 `url` 推断.

#### Scenario: 读取已有配置

- **WHEN** `~/.hermes/config.yaml` 存在且包含 `mcp_servers` 字段
- **THEN** adapter 使用 `yaml.parse` 解析文件, 提取 `mcp_servers` 下所有 MCP 服务条目

#### Scenario: 读取不存在的配置文件

- **WHEN** `~/.hermes/config.yaml` 不存在
- **THEN** adapter 返回空的服务器记录 `{}`

#### Scenario: 写入新 stdio 服务

- **WHEN** 向 Hermes 添加一个 stdio 类型的 MCP 服务
- **THEN** adapter 读取 `~/.hermes/config.yaml` (不存在则创建 `~/.hermes/` 目录和文件), 在顶层 `mcp_servers` 下添加服务条目, 使用原生 `command/args/env` 格式; 解析 `${VAR}` 引用后剩余的 env vars 直接写入 `env` mapping (无剩余时省略 `env` 字段), 保留文件中已有的其他顶层字段和服务条目

#### Scenario: 写入新 http 服务

- **WHEN** 向 Hermes 添加一个 http 类型的 MCP 服务
- **THEN** adapter 在 `mcp_servers` 下写入 `{ url: "...", headers: { ... } }` (无 `type` 字段); headers 为空时省略 `headers` 字段

#### Scenario: 同名冲突

- **WHEN** `~/.hermes/config.yaml` 中 `mcp_servers` 下已存在同名服务
- **THEN** adapter 抛出冲突错误, 不修改文件

#### Scenario: 移除服务

- **WHEN** 从 Hermes 配置中移除一个 MCP 服务
- **THEN** adapter 从 `mcp_servers` 中删除该条目, 保留其他所有条目和顶层字段

#### Scenario: 检查服务是否存在

- **WHEN** 查询 Hermes 配置中某服务是否存在
- **THEN** adapter 返回该服务名是否在 `mcp_servers` 中

## MODIFIED Requirements

### Requirement: Agent 自动检测

系统 SHALL 在项目目录中自动检测哪些 agent 的配置文件已存在.

#### Scenario: 检测项目中的 agent

- **WHEN** 系统需要确定项目使用了哪些 agent
- **THEN** 系统检查以下文件是否存在: `.mcp.json` (Claude Code), `.codex/` 目录 (Codex), `.cursor/mcp.json` (Cursor), `.gemini/settings.json` (Gemini CLI), `opencode.json` (OpenCode); Antigravity, OpenClaw 和 Hermes 始终作为可选项列出 (因为仅全局配置)
