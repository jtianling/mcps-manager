## ADDED Requirements

### Requirement: Authorization Bearer envVar 填充 bearerTokenEnvVar

系统 SHALL 在 manifest apply 阶段, 对每个 `appliedAs` 满足 `kind = "header"`, `name` 大小写不敏感等于 `"Authorization"`, `format = "Bearer ${VALUE}"` (允许前后空白差异) 的 envVar, 把该 envVar 的 `name` 填充到所有 HTTP server config 的 `bearerTokenEnvVar` 可选字段 — **无论用户是否提供了该 envVar 的值**. 明文 header 插入逻辑维持现状 (仅在值存在且目标 header 未被显式声明时插入), 由各 adapter 自行决定消费 `bearerTokenEnvVar` 还是明文 header.

多个 envVar 同时满足条件时, SHALL 取声明顺序的第一个.

#### Scenario: 用户提供了 token 值

- **WHEN** manifest envVar `{name: "CROSS_AGENT_TEAMS_MCP_TOKEN", appliedAs: {kind: "header", name: "Authorization", format: "Bearer ${VALUE}"}}`, 用户输入值 `abc123`
- **THEN** 解析出的 HTTP config SHALL 同时含 `bearerTokenEnvVar = "CROSS_AGENT_TEAMS_MCP_TOKEN"` 与 header `Authorization = "Bearer abc123"`

#### Scenario: 用户未提供 token 值

- **WHEN** 同上 envVar 为 optional 且用户跳过输入
- **THEN** 解析出的 HTTP config SHALL 含 `bearerTokenEnvVar = "CROSS_AGENT_TEAMS_MCP_TOKEN"`, headers 中 SHALL NOT 出现 `Authorization`

#### Scenario: 非 Authorization Bearer 形态不填充

- **WHEN** manifest envVar `appliedAs = {kind: "header", name: "X-Api-Key", format: "${VALUE}"}`
- **THEN** 解析出的 HTTP config SHALL NOT 含 `bearerTokenEnvVar`, 该 envVar 走既有明文 header 插入逻辑
