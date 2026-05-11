## Purpose

为 7 个编程 agent 提供配置适配器, 处理各自不同的配置文件格式和路径.
## Requirements
### Requirement: Adapter output format

Adapters SHALL output MCP server configs according to each agent's native format. The adapter SHALL:

1. Substitute `${VAR_NAME}` references in args with actual values from the env block
2. For remaining env vars (not referenced in args), use the `env` command as a wrapper with `KEY=value` args, **UNLESS** the agent adapter declares native support for a dedicated env field in its target config format (e.g. Codex's `[mcp_servers.<name>].env = { KEY = "V" }` table). Native-env adapters SHALL write remaining env vars into the native env field and MUST NOT use the `env` command wrapper.
3. Never include redundant `env`/`environment` fields when the adapter has chosen the wrapper strategy; native-env adapters WILL include the native env field when there are remaining env vars

When reading configs back (`fromAgentFormat`), the adapter SHALL handle:
- Native env field (if the adapter declares native-env support)
- `env` command wrapper format (`command: "env"`, KEY=value args)
- Legacy separate `env`/`environment` field

for backward compatibility.

#### Scenario: Args contain ${VAR} references
- **WHEN** a stdio config has args containing `${JINA_API_KEY}` and env `{ "JINA_API_KEY": "xxx" }`
- **THEN** the adapter substitutes `${JINA_API_KEY}` with `xxx` directly in the args, removes the env field, and does NOT use env command wrapper nor emit a native env field (since no remaining env vars)

#### Scenario: Env vars not referenced in args (wrapper-strategy adapter)
- **WHEN** a stdio config has env vars `{ "BRAVE_API_KEY": "xxx" }` with no `${BRAVE_API_KEY}` in args, written to an adapter that uses the wrapper strategy (e.g. Claude Code, Gemini CLI, OpenCode, Antigravity, OpenClaw)
- **THEN** the adapter uses `env` command wrapper: `command: "env"`, args: `["BRAVE_API_KEY=xxx", "npx", ...]`

#### Scenario: Env vars not referenced in args (native-env adapter)
- **WHEN** a stdio config has env vars `{ "BRAVE_API_KEY": "xxx" }` with no `${BRAVE_API_KEY}` in args, written to a native-env adapter (e.g. Codex)
- **THEN** the adapter keeps `command` as the original binary, emits `args` without wrapper prefixes, and writes `env = { "BRAVE_API_KEY" = "xxx" }` in the agent's native env field

#### Scenario: Mixed - some referenced, some not
- **WHEN** a stdio config has `${API_KEY}` in args AND a separate `DEBUG` env var
- **THEN** `${API_KEY}` is substituted in args, `DEBUG` is emitted via the adapter's chosen env strategy (wrapper for wrapper-strategy adapters, native field for native-env adapters)

#### Scenario: Write stdio config without env vars
- **WHEN** a stdio config has empty env vars
- **THEN** the adapter outputs config with the original command and args, and NO `env`/`environment` field (regardless of wrapper vs native strategy)

#### Scenario: Read new format config
- **WHEN** a wrapper-strategy adapter reads a config with `command: "env"` and args containing KEY=value entries
- **THEN** it extracts env vars from the KEY=value args and reconstructs the original command, args, and env

#### Scenario: Read native env format config
- **WHEN** a native-env adapter reads a config with a native env field (e.g. Codex's `env = { ... }` TOML table)
- **THEN** it extracts env vars from that field and returns them in the reconstructed `DefaultConfig.env`

#### Scenario: Read legacy wrapper from a native-env adapter's file
- **WHEN** a native-env adapter reads a config that was written by an earlier version using `command: "env"` wrapper
- **THEN** it falls back to the wrapper read path, extracting env vars correctly so downstream `sync`/`list --deployed` operations work against old files

#### Scenario: Read legacy format config (backward compatibility)
- **WHEN** the adapter reads a config with a separate `env`/`environment` field
- **THEN** it parses the env vars from that field as before

### Requirement: Claude Code Adapter

系统 SHALL 提供 Claude Code 的配置适配器, 操作 `.mcp.json` 文件.

#### Scenario: 读取已有配置

- **WHEN** 项目根目录存在 `.mcp.json`
- **THEN** adapter 解析文件, 提取 `mcpServers` 下所有 MCP 服务条目

#### Scenario: 写入新服务

- **WHEN** 向 Claude Code 添加一个 MCP 服务
- **THEN** adapter 读取 `.mcp.json` (不存在则创建), 在 `mcpServers` 下添加服务条目, 使用 env command wrapper 格式 (stdio 有 env vars 时) 或 HTTP 格式 `{ "type": "http", "url": "...", "headers": {...} }`, 保留文件中已有的其他服务条目

#### Scenario: 同名冲突

- **WHEN** `.mcp.json` 中已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

### Requirement: Codex Adapter

系统 SHALL 提供 Codex 的配置适配器, 操作 `.codex/config.toml` 文件. Adapter 的 id SHALL 为 `"codex"`, name SHALL 为 `"Codex"`, 以表示同时支持 Codex CLI 和 Codex App.

Adapter 写入 HTTP transport 的 MCP 服务时, SHALL 使用 Codex `StreamableHttp` transport 的字段命名: `url` 作为 endpoint, `http_headers` 作为 header 映射 (**NOT** `headers`). 对应的 `fromAgentFormat` SHALL 从 `http_headers` 读取 header 映射.

#### Scenario: 读取已有配置

- **WHEN** 项目中存在 `.codex/config.toml`
- **THEN** adapter 解析 TOML 文件, 提取 `[mcp_servers.*]` 下所有 MCP 服务条目, 对 HTTP 条目从 `http_headers` 字段读取 headers

#### Scenario: 写入新服务 (stdio)

- **WHEN** 向 Codex 添加一个 stdio transport 的 MCP 服务
- **THEN** adapter 读取 `.codex/config.toml` (不存在则创建 `.codex/` 目录和文件), 在 `[mcp_servers.<name>]` section 下添加服务配置, 使用 env command wrapper 格式 (有 env vars 时 command = "env"), MUST 保留文件中已有的非 MCP section 和注释

#### Scenario: 写入新服务 (http)

- **WHEN** 向 Codex 添加一个 http transport 的 MCP 服务
- **THEN** adapter 在 `[mcp_servers.<name>]` section 下写入 `url = "..."` 和 `http_headers = { ... }` (inline table 或子表均可), 字段名 MUST 为 `http_headers` 而非 `headers`, MUST 保留文件中已有的非 MCP section 和注释

#### Scenario: HTTP round-trip

- **WHEN** 对一个 HTTP 类型的 `DefaultConfig` 调用 `toAgentFormat` 得到 TOML 形态的对象, 再对该对象调用 `fromAgentFormat`
- **THEN** 返回的 `DefaultConfig` 与原对象的 `url` 和 `headers` 语义完全一致

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
- **THEN** adapter 读取 `.gemini/settings.json` (不存在则创建 `.gemini/` 目录和文件), 在 `mcpServers` 下添加服务条目, 使用 env command wrapper 格式, 保留文件中已有的其他字段 (如 `mcp`, `theme` 等非 mcpServers 字段)

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
- **THEN** adapter 在 `mcp` 下添加服务条目, 格式为 `{ "type": "local", "command": ["env", "KEY=val", "<cmd>", ...] }` (有 env vars 时) 或 `{ "type": "local", "command": ["<cmd>", "<arg1>", ...] }` (无 env vars 时), 不使用 `environment` 字段

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
- **THEN** adapter 读取 `~/.gemini/antigravity/mcp_config.json` (不存在则创建目录和文件), 在 `mcpServers` 下添加服务条目, 使用 env command wrapper 格式 或 HTTP 格式 `{ "serverUrl": "...", "headers": {...} }`, 注意 HTTP 时 url key MUST 为 `serverUrl`

#### Scenario: 同名冲突

- **WHEN** 配置文件中 `mcpServers` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件

### Requirement: Agent 自动检测

系统 SHALL 在项目目录中自动检测哪些 agent 的配置文件已存在.

#### Scenario: 检测项目中的 agent

- **WHEN** 系统需要确定项目使用了哪些 agent
- **THEN** 系统检查以下文件是否存在: `.mcp.json` (Claude Code), `.codex/` 目录 (Codex), `.cursor/mcp.json` (Cursor), `.gemini/settings.json` (Gemini CLI), `opencode.json` (OpenCode); Antigravity, OpenClaw 和 Hermes 始终作为可选项列出 (因为仅全局配置)

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

