## MODIFIED Requirements

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
