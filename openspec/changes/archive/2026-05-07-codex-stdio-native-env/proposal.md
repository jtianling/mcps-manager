## Why

`codexAdapter` 在 stdio 传输上把 env 编码成 `command = "env"` + `KEY=VALUE` args 前缀（`src/adapters/codex.ts:17-20`）。Codex 的官方 schema（`RawMcpServerConfig`）原生支持 `env = { KEY = "V" }` 顶层表，用 wrapper 有几个问题：

1. Windows 下 `env` 命令不存在，当前适配器的 stdio 服务在 Windows 的 Codex 上直接跑不起来
2. Codex TUI / 日志里看到的 "command" 变成 `env` 而不是真正的 MCP server 二进制，debug 不直观
3. 和 agent-adapters spec 里"所有 adapter 都用 env wrapper"的通用要求捆绑，导致这个明显是 Codex-specific 的次优实现没被单独审视

## What Changes

- 修正 `codexAdapter.toAgentFormat` stdio 分支：不再用 `command = "env"` 前缀，改为在返回对象里直接挂 `env = { ...config.env }`（`resolveEnvInArgs` 做的 `${VAR}` 展开逻辑保留不变，只针对没被展开的残余 env vars 改走原生 `env` 表）
- 修正 `codexAdapter.fromAgentFormat` stdio 分支：优先从原生 `env` / `environment` 字段读取 env 映射；保留对 `command = "env"` wrapper 格式的读路径，用于迁移读旧配置
- `specs/agent-adapters` 的 "Adapter output format" 通用 requirement 加上 Codex 例外说明，Codex Adapter requirement 本身 MODIFIED 为"stdio 使用原生 env 表"
- 补充 Codex adapter 的 stdio env 原生表写入 + 迁移读取的单元测试

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-adapters`: "Adapter output format" 通用 requirement 调整为承认 Codex 使用原生 env 字段；Codex Adapter requirement 的 stdio 写入 scenario 从 "env command wrapper 格式" 改为 "原生 `env` 表"，并新增迁移读取 scenario

## Impact

- 代码：`src/adapters/codex.ts`（`toAgentFormat` stdio 分支 + `fromAgentFormat` stdio 分支）
- 规范：`openspec/specs/agent-adapters/spec.md` 两处 requirement
- 测试：`src/adapters/__tests__/codex.test.ts`（或等价 fixture）
- 依赖：无
- 用户影响：
  - 老版本 mcpsmgr 写入的 `.codex/config.toml`（含 `command = "env"` wrapper）仍可被 read 回来，`sync` / `list --deployed` 行为不破
  - 新版本部署后的 `.codex/config.toml` 里 `[mcp_servers.<name>]` 块下会出现 `env = { ... }` 表
- 与 `fix-codex-http-headers` 的关系：两者都动 `src/adapters/codex.ts`，但分支不同（HTTP vs stdio），互不冲突；merge 顺序无关
