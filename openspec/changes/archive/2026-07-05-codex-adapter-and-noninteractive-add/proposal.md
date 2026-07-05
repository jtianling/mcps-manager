## Why

xats 侧 (cross-agent-teams-mcp) 在真实设备上落地 `mcpsmgr add -a codex / -a opencode` 时实测发现 4 个问题 (mac mini E2E 复现): 写出的 codex 配置缺顶级 `experimental_use_rmcp_client` 导致旧版 codex 不加载 streamable-http MCP; token 以明文 `http_headers` 落盘有签入仓库泄露风险, 且 token 缺失时恒写空 headers 表在 tokened daemon 下必然 401; codex `--remote`/app-server 模式 MCP 由 CODEX_HOME 全局配置加载, 项目级 `.codex/config.toml` 不生效; code agent 无 TTY 场景下 env var 值只能交互输入, `-y` 又无条件跳过 optional token。

## What Changes

- codex adapter 写 http/streamable-http server 时, 确保目标 config.toml 顶级存在 `experimental_use_rmcp_client = true` (已存在则不覆盖; 对新版 codex 为无害兼容键, 对旧版为必需开关)。
- manifest envVar 的 `appliedAs` 为 `{kind:"header", name:"Authorization", format:"Bearer ${VALUE}"}` 时, `HttpConfig` 增加可选字段 `bearerTokenEnvVar` (取 `envVars[].name`, 无论用户是否提供了值)。
- codex adapter: 存在 `bearerTokenEnvVar` 时写 codex 官方键 `bearer_token_env_var = "<name>"`, 不再写明文 `Authorization` header; `http_headers` 为空时整块省略; `fromAgentFormat` 支持读回 `bearer_token_env_var` (round-trip)。
- opencode adapter: `headers` 为空时省略该键 (有 token 值时维持明文 Bearer 现状, opencode 无 env 引用机制)。
- `mcpsmgr add` 新增 `--global` flag: 配置写到 agent 的全局配置位置 (目前仅 codex 支持, `~/.codex/config.toml`); 不支持全局写入或本身已是全局的 adapter 报错 exit 1。
- `mcpsmgr add` 新增可重复 flag `--var NAME=VALUE` (仅 manifest-driven add); envVar 取值优先级 `--var` > `process.env[name]` > 交互 prompt; `-y` 模式下非交互来源可用则用, required 且无值时报错 (现有报错文案由此变为事实)。

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `agent-adapters`: Codex Adapter 增加 rmcp 兼容开关写入、`bearer_token_env_var` 写入/读回、空 `http_headers` 省略、全局配置路径写入; OpenCode Adapter 增加空 `headers` 省略。
- `manifest-analysis`: envVar `appliedAs` 为 Authorization Bearer header 时填充 `bearerTokenEnvVar`; envVar 值来源扩展为 `--var` / `process.env` / 交互 prompt 三级优先。
- `project-operations`: `add` 命令新增 `--global` 与 `--var NAME=VALUE` flag 及其校验、错误路径。

## Impact

- 受影响代码: `src/adapters/codex.ts`, `src/adapters/opencode.ts`, `src/types.ts` (HttpConfig), `src/install/manifest-apply.ts`, `src/commands/add.ts`, `src/index.ts` (flag 注册), 对应 `__tests__`。
- 行为变化: codex 的 token 表达从明文 header 变为 env var 引用 — 依赖明文 header 的既有配置文件不受影响 (读回兼容), 但新写入的配置要求运行时环境存在对应 env var (xats 侧 zshrc 已按此约定 export)。
- 跨仓库契约: `bearer_token_env_var` 的名字取自 manifest `envVars[].name`; xats 仓库计划将其改名为 `CROSS_AGENT_TEAMS_MCP_TOKEN`, 由对方负责, 本仓库不涉及。
