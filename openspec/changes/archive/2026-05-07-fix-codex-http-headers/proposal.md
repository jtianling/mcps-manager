## Why

`codexAdapter` 在 HTTP 传输的 `toAgentFormat` 里把 headers 写成 `headers` 字段，但 Codex 官方 schema (`codex-rs/core/config.schema.json` → `RawMcpServerConfig`) 只认 `http_headers`。实测把 `agent-teams-mcp` 部署到 `.codex/config.toml` 后 Codex 会忽略 Authorization 头，导致需要鉴权的远程 MCP 服务连接失败。当前仓库里 `specs/agent-adapters` 的 Codex requirement 也完全没提 HTTP 场景，这次一起补齐。

## What Changes

- 修正 `codexAdapter.toAgentFormat` HTTP 分支：`headers: {...}` → `http_headers: {...}`，对齐 Codex 的 `StreamableHttp` transport schema
- 修正 `codexAdapter.fromAgentFormat` HTTP 分支：读取 `http_headers`（不再读旧的 `headers`，无历史配置需要兼容）
- 更新 `specs/agent-adapters` 的 Codex Adapter requirement：显式加上 HTTP 读写场景，明确字段名是 `http_headers`
- 补充 Codex adapter 的单元测试，覆盖 HTTP 写入/读回 round-trip

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-adapters`: Codex Adapter requirement 新增 HTTP 读写 scenario，并在"写入新服务"场景中区分 stdio / HTTP 两种形态、明确 HTTP 使用 `http_headers` 字段

## Impact

- 代码：`src/adapters/codex.ts`（`toAgentFormat` / `fromAgentFormat` 各动几行）
- 规范：`openspec/specs/agent-adapters/spec.md` 的 Codex Adapter section
- 测试：`src/adapters/__tests__/codex.test.ts`（或等价 fixture）新增 HTTP round-trip 用例
- 依赖：无
- 用户影响：用之前 mcpsmgr 部署过 Codex HTTP MCP 的项目，`.codex/config.toml` 里会有错误的 `[mcp_servers.<name>.headers]` 段——用户需要重新运行 `mcpsmgr add <name>` 或 `mcpsmgr sync` 让 adapter 重写正确格式。该副作用在本 change 里不自动修复，只在 proposal 和 PR 描述中提示
