## MODIFIED Requirements

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

### Requirement: Codex Adapter

系统 SHALL 提供 Codex 的配置适配器, 操作 `.codex/config.toml` 文件. Adapter 的 id SHALL 为 `"codex"`, name SHALL 为 `"Codex"`, 以表示同时支持 Codex CLI 和 Codex App.

Codex Adapter SHALL declare native-env support: stdio MCP 服务在写入时 MUST 使用 Codex `RawMcpServerConfig` 原生的 `env` 字段（即 TOML 里 `[mcp_servers.<name>]` 块下的 `env = { KEY = "V" }` 表或子表），MUST NOT 使用 `env` 命令 wrapper 格式.

#### Scenario: 读取已有配置

- **WHEN** 项目中存在 `.codex/config.toml`
- **THEN** adapter 解析 TOML 文件, 提取 `[mcp_servers.*]` 下所有 MCP 服务条目, 对 stdio 条目优先从原生 `env` 字段读取 env vars, 若缺失 `env` 字段但 `command === "env"` 则从 args 中的 KEY=value 前缀回退读取 (迁移老格式)

#### Scenario: 写入新服务 (stdio)

- **WHEN** 向 Codex 添加一个 stdio transport 的 MCP 服务
- **THEN** adapter 读取 `.codex/config.toml` (不存在则创建 `.codex/` 目录和文件), 在 `[mcp_servers.<name>]` section 下写入 `command = "<bin>"` 和 `args = [...]`, 对于未被 `${VAR}` 展开吸收的剩余 env vars MUST 写入 Codex 原生 `env = { ... }` 表, MUST NOT 使用 `command = "env"` + args 前缀的 wrapper 形式, MUST 保留文件中已有的非 MCP section 和注释

#### Scenario: 写入新服务 (http)

- **WHEN** 向 Codex 添加一个 http transport 的 MCP 服务
- **THEN** adapter 按 HTTP scenario 写入 (详见本 requirement 其它 scenario), 本 change 不修改 HTTP 行为

#### Scenario: 迁移老格式读取

- **WHEN** `.codex/config.toml` 中某 `[mcp_servers.<name>]` 块是老版本 mcpsmgr 写的 (`command = "env"` + KEY=VALUE args 前缀)
- **THEN** adapter 的 `fromAgentFormat` MUST 正确解出原命令、args、env vars, 使下游 `mcpsmgr sync` / `mcpsmgr list --deployed` 行为不回归

#### Scenario: 同名冲突

- **WHEN** `.codex/config.toml` 中 `[mcp_servers]` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件
