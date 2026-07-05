## MODIFIED Requirements

### Requirement: Codex Adapter

系统 SHALL 提供 Codex 的配置适配器, 操作 `.codex/config.toml` 文件. Adapter 的 id SHALL 为 `"codex"`, name SHALL 为 `"Codex"`, 以表示同时支持 Codex CLI 和 Codex App.

Adapter 写入 HTTP transport 的 MCP 服务时, SHALL 使用 Codex `StreamableHttp` transport 的字段命名: `url` 作为 endpoint, `http_headers` 作为 header 映射 (**NOT** `headers`). `http_headers` 为空时 SHALL 整块省略, 不写空表. 对应的 `fromAgentFormat` SHALL 从 `http_headers` 读取 header 映射 (缺失视为空).

Adapter 写入 HTTP transport 的 MCP 服务时, SHALL 确保目标 config.toml 顶级存在 `experimental_use_rmcp_client = true`: 该键不存在时写入 `true`; 已存在时 (无论值) 不修改. 背景: 旧版 Codex 必须有该开关才加载 streamable-http MCP, 新版已默认 rmcp 且容忍此键 (兼容性写入). stdio 服务写入 SHALL NOT 触发该键.

`DefaultConfig` 的 HTTP 形态含可选字段 `bearerTokenEnvVar` 时, adapter SHALL 写 `bearer_token_env_var = "<name>"` (Codex 官方键), 且 SHALL NOT 写明文 `Authorization` header (即使 headers 中存在); 其他 header 照常写入 `http_headers`. `fromAgentFormat` SHALL 把 `bearer_token_env_var` 读回为 `bearerTokenEnvVar` (round-trip).

Adapter SHALL 声明 `globalDir()` 返回用户 home 目录, 使 `--global` 写入路径为 `~/.codex/config.toml` (CODEX_HOME 布局).

#### Scenario: 读取已有配置

- **WHEN** 项目中存在 `.codex/config.toml`
- **THEN** adapter 解析 TOML 文件, 提取 `[mcp_servers.*]` 下所有 MCP 服务条目, 对 HTTP 条目从 `http_headers` 字段读取 headers (缺失视为空), 从 `bearer_token_env_var` 读取 `bearerTokenEnvVar` (缺失则无)

#### Scenario: 写入新服务 (stdio)

- **WHEN** 向 Codex 添加一个 stdio transport 的 MCP 服务
- **THEN** adapter 读取 `.codex/config.toml` (不存在则创建 `.codex/` 目录和文件), 在 `[mcp_servers.<name>]` section 下添加服务配置, 使用 env command wrapper 格式 (有 env vars 时 command = "env"), MUST 保留文件中已有的非 MCP section (注释不保留: 写入走 TOML parse/re-stringify), MUST NOT 写入 `experimental_use_rmcp_client`

#### Scenario: 写入新服务 (http)

- **WHEN** 向 Codex 添加一个 http transport 的 MCP 服务, headers 非空且无 `bearerTokenEnvVar`
- **THEN** adapter 在 `[mcp_servers.<name>]` section 下写入 `url = "..."` 和 `http_headers = { ... }` (inline table 或子表均可), 字段名 MUST 为 `http_headers` 而非 `headers`, MUST 保留文件中已有的非 MCP section (注释不保留: 写入走 TOML parse/re-stringify)

#### Scenario: 写入 http 服务时补 rmcp 兼容开关

- **WHEN** 向 Codex 添加一个 http transport 的 MCP 服务, 目标 config.toml 顶级不存在 `experimental_use_rmcp_client`
- **THEN** adapter SHALL 在顶级写入 `experimental_use_rmcp_client = true`, 与 server 条目在同一次写盘中完成

#### Scenario: rmcp 开关已存在时不动

- **WHEN** 目标 config.toml 顶级已有 `experimental_use_rmcp_client = false`, 向 Codex 添加一个 http transport 的 MCP 服务
- **THEN** adapter SHALL 保持该键值为 `false` 不修改

#### Scenario: 写入含 bearerTokenEnvVar 的 http 服务

- **WHEN** 写入的 HTTP config 含 `bearerTokenEnvVar = "CROSS_AGENT_TEAMS_MCP_TOKEN"` 且 headers 含 `Authorization` 明文
- **THEN** adapter SHALL 写 `bearer_token_env_var = "CROSS_AGENT_TEAMS_MCP_TOKEN"`, SHALL NOT 写 `Authorization` 到 `http_headers`; 其余 header 照常写入

#### Scenario: token 缺失时省略空 http_headers

- **WHEN** 写入的 HTTP config headers 为空 (用户未提供 token 且 manifest 无静态 header)
- **THEN** adapter SHALL NOT 写出 `http_headers` 键 (整块省略, 而非空表)

#### Scenario: HTTP round-trip

- **WHEN** 对一个 HTTP 类型的 `DefaultConfig` (含或不含 `bearerTokenEnvVar`) 调用 `toAgentFormat` 得到 TOML 形态的对象, 再对该对象调用 `fromAgentFormat`
- **THEN** 返回的 `DefaultConfig` 与原对象的 `url`, `headers`, `bearerTokenEnvVar` 语义完全一致

#### Scenario: 全局写入

- **WHEN** 调用方以 `globalDir()` 返回的目录作为写入目录写 MCP 服务
- **THEN** adapter SHALL 写入 `~/.codex/config.toml`, 行为 (rmcp 开关, 冲突检测, 保留已有 section) 与项目级写入一致

#### Scenario: 同名冲突

- **WHEN** `.codex/config.toml` 中 `[mcp_servers]` 下已存在同名服务
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

- **WHEN** 向 OpenCode 添加一个 http 类型的 MCP 服务且 headers 非空
- **THEN** adapter 在 `mcp` 下添加服务条目, 格式为 `{ "type": "remote", "url": "...", "headers": {...} }`

#### Scenario: 写入新服务 (http, headers 为空)

- **WHEN** 向 OpenCode 添加一个 http 类型的 MCP 服务且 headers 为空对象
- **THEN** adapter SHALL 写出 `{ "type": "remote", "url": "..." }`, SHALL NOT 包含空的 `"headers": {}` 键

#### Scenario: 同名冲突

- **WHEN** `opencode.json` 中 `mcp` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件
