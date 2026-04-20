## Context

当前所有 agent adapter 的 stdio 输出格式由 `specs/agent-adapters/spec.md` 的 "Adapter output format" requirement 统一约束：env vars 先做 `${VAR}` 替换到 args 里，剩下的用 `command: "env"` + `KEY=value` args 包一层（`src/adapters/env-args.ts` 是共享工具）。这套策略的原始动机是"让所有 agent 的输出形式统一"。

但 Codex 原生在 `config.toml` 里支持 `[mcp_servers.<name>]` 下直接放 `env = { KEY = "V" }` 表（来源：`codex-rs/core/config.schema.json` 的 `RawMcpServerConfig`）。用 wrapper 对 Codex 造成三个实际问题：

1. Windows 没有独立的 `env` 可执行文件（cmd.exe 里 `set KEY=V & cmd` 是完全不同的语法），wrapper 格式在 Windows 下 Codex 根本起不起来
2. Codex TUI / 错误日志里把 "command" 当成 `env`，真正的 server 二进制埋在 args 深处，诊断体验差
3. 违反了"按 agent 特性选 idiomatic 形式"的原则

本 change 只动 Codex 这一家。Claude Code 虽然也原生支持 `env` 字段，但那是独立权衡（scope 更大，且涉及到 Claude 自己支持 `${VAR}` 展开的行为差异），放到单独 change 讨论。

## Goals / Non-Goals

**Goals:**
- `codexAdapter.toAgentFormat` stdio 分支：原生 `env = {...}` 表输出
- `codexAdapter.fromAgentFormat` stdio 分支：优先读原生 `env`/`environment` 字段；保留对 `command = "env"` wrapper 的读取，迁移老 `.codex/config.toml`
- "Adapter output format" requirement 承认 Codex 例外
- `resolveEnvInArgs` 对 args 中 `${VAR}` 的展开逻辑保留：Codex 里被 args 引用的 env 继续展开，剩余 env 进 `env` 表（避免重复声明）

**Non-Goals:**
- 不动 Claude Code / Gemini CLI / Antigravity / OpenClaw / OpenCode 的 stdio env 策略（即使其中某些也原生支持 `env`）
- 不暴露 Codex 的 `env_vars`（透传宿主 env）/`env_http_headers` 等特殊字段
- 不自动迁移用户已经写好的 `.codex/config.toml` 文件（下一次 `mcpsmgr add` / `sync` 覆盖该 server 时自然会重写）
- 不动 HTTP 分支（`fix-codex-http-headers` change 负责）

## Decisions

**D1：保留对 `command = "env"` wrapper 的读路径**
- 选项 A（本 change 采用）：`fromAgentFormat` 同时认 `env` 字段（新）和 `command === "env"` 前缀（旧）
- 选项 B：只认新格式，老用户的 `.codex/config.toml` 无法被 `mcpsmgr list --deployed` / `sync` 正确回读
- 选 A 理由：这不是"保留旧写入行为"（我们不再写 wrapper），而是"一次性迁移读入"。mcpsmgr 的设计是 read-then-merge，丢掉读路径会让 `sync` 在老项目上误以为 server 没部署，导致重复添加或冲突报错

**D2：`resolveEnvInArgs` 继续调用**
- args 里 `${JINA_API_KEY}` 的展开策略跨 agent 一致（`specs/agent-adapters` 第 1 条"Substitute `${VAR_NAME}` references"），不动。只是对 "remaining env vars (not referenced in args)" 的去向，Codex 从 wrapper args 改为 `env` 表

**D3：空 env 对象的处理**
- 当 `remainingEnv` 为空时，TOML 输出 **不写** `env` 字段（保持最小 diff，避免无意义 `env = {}`）

**D4：spec 修改范围 — 通用 requirement + Codex 专属 requirement 都要动**
- 通用 requirement 第 2 条"For remaining env vars, use the `env` command as a wrapper" 必须放宽：改为"SHALL use the `env` command wrapper **unless the agent adapter declares native env support**"
- Codex Adapter requirement "写入新服务 (stdio)" scenario 从 wrapper 格式改为原生 `env` 表

## Risks / Trade-offs

- [通用 requirement 加了例外 → 其它 adapter 未来也想用原生 env 时会修改这个 requirement] → 可接受。每加一家原生支持的 adapter 都是一次 spec 审视机会，反而鼓励有意识决策
- [老用户升级后，首次运行 `mcpsmgr sync` 才触发 `.codex/config.toml` 重写] → 期望行为。用户在这之前 `list --deployed` 看到的仍是正确的 server 列表（因为保留了 wrapper 读路径）
- [空 env 不写 `env` 字段造成隐式语义] → 符合 TOML 惯用和 Codex schema 的 default（`env` 字段 optional）；fromAgentFormat 读到缺失 env 时返回 `env: {}`，对称

## Open Questions

（无）
