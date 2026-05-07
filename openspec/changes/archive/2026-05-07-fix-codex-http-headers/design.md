## Context

`src/adapters/codex.ts` 在 HTTP 传输 `toAgentFormat` 里产出 `{ url, headers }`，写进 TOML 后变成 `[mcp_servers.<name>]` 块下的 `url` 键 + `[mcp_servers.<name>.headers]` 嵌套表。Codex 官方 schema（`codex-rs/core/config.schema.json` 里的 `RawMcpServerConfig`）只定义 `url`、`http_headers`、`env_http_headers`、`bearer_token`、`bearer_token_env_var` 五个与 HTTP 相关的字段——没有 `headers`。这意味着 Codex 解析我们写的 TOML 时会忽略 Authorization 头。

本 change 只修这一个字段名 + 一条 fromAgentFormat 的读路径 + 一处 spec 描述。不动 DefaultConfig 中间表示，不动 env 处理，不动鉴权模型（留给下一个 change 讨论 `bearer_token_env_var`）。

## Goals / Non-Goals

**Goals:**
- `codexAdapter.toAgentFormat` 在 HTTP 分支输出的 JS 对象字段从 `headers` 改名为 `http_headers`，TOML 序列化后为合法 Codex 配置
- `codexAdapter.fromAgentFormat` 在 HTTP 分支从 `http_headers` 读取
- `specs/agent-adapters` 的 Codex Adapter requirement 显式加上 HTTP 读写 scenario

**Non-Goals:**
- 不动 stdio 的 `env` 处理（另一个 change 处理）
- 不引入 `bearer_token_env_var` / `env_http_headers` 等 Codex 特有字段（DefaultConfig 目前没有对应的"env-ref"概念，扩展会放大 scope）
- 不给老用户自动迁移已经写坏的 `.codex/config.toml`（只在 PR 描述里告知 `mcpsmgr sync` 会覆盖正确字段）
- 不改 Claude Code / OpenCode / Gemini / Antigravity / OpenClaw adapters（它们的 HTTP 输出已验证正确）

## Decisions

**D1：只改字段名，不动中间表示**
- 选项 A（本 change 采用）：`toAgentFormat` / `fromAgentFormat` 内部把 `DefaultConfig.headers` 映射成 TOML 里的 `http_headers`。`DefaultConfig.headers` 保持语义不变。
- 选项 B：把 `DefaultConfig` 的 `http` 变体拆出 `http_headers`、`bearer_token_env_var` 等字段。
- 选 A：这是单点 bug，选 B 会把 Codex 的命名污染到所有 adapter；且其它 agent 都用 `headers`。

**D2：不保留 `headers` fallback 读路径**
- 项目对 backwards-compatibility shim 明确反对（参见全局约束"don't add backwards-compat hacks"）。
- mcpsmgr 的中央库里不存 TOML，只存归一化 JSON；用户的 `.codex/config.toml` 是 mcpsmgr 自己写的，重新 `sync` 就能修复。不需要支持读回自己曾经写错的文件。

**D3：spec 改法用 MODIFIED**
- Codex Adapter requirement 当前"写入新服务" scenario 描述了 env wrapper 但没区分 stdio/HTTP。直接 MODIFIED 整个 requirement，把原 scenario 拆成 stdio 和 HTTP 两条，HTTP 的明确字段名。保留原有"读取已有配置""同名冲突"两条 scenario。

## Risks / Trade-offs

- [已部署的 `.codex/config.toml` 里残留坏 `headers` 段] → mcpsmgr `add` / `sync` 都用 read-then-merge，如果用户 file 里手写了其它 `[mcp_servers.X.headers]` 而我们不清理，写入时会是 stale 表叠加。Mitigation：在 PR 描述里提醒用户首次升级后手动删一次或 `mcpsmgr remove && mcpsmgr add` 重建。不在本 change 代码里做自动清理——动 read/write 语义会扩大 scope。
- [schema 字段命名与其它 adapter 不一致（headers vs http_headers）] → 仅 Codex 对外 TOML 字段名不同，adapter 内部仍按 `DefaultConfig.headers` 流转，调用方感知不到差异。
