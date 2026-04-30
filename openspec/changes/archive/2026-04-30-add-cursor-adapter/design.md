## Context

Cursor 是基于 VS Code fork 的 AI IDE, 自 2025 年起原生支持 MCP. 配置文件位置:

- 项目级: `<repo>/.cursor/mcp.json`
- 全局: `~/.cursor/mcp.json`

格式与 Claude Code / Gemini CLI 同源 (顶层 `mcpServers` 对象), 字段约定:

- stdio: `{ command, args, env? }`, 没有 `type` 字段; transport 由是否存在 `command` 推断
- HTTP / SSE: `{ url, headers? }`, 同样无 `type` 字段; transport 由是否存在 `url` 推断

来源:
- https://cursor.com/docs/cli/mcp
- https://www.truefoundry.com/blog/mcp-servers-in-cursor-setup-configuration-and-security-guide

## Goals / Non-Goals

**Goals:**
- 在 mcpsmgr 中加入 Cursor 作为第 7 个支持的 agent
- 项目级配置文件路径: `.cursor/mcp.json`, 与 Cursor 自身 doc 一致
- 写入格式遵循全局 "Adapter output format" 通用要求 (env wrapper 策略, 与 Gemini CLI 一致)
- 自动检测: 当项目有 `.cursor/mcp.json` 时 detect 命中 Cursor

**Non-Goals:**
- 不支持 Cursor 的全局配置 `~/.cursor/mcp.json` (项目级足以覆盖核心使用场景, 与现有 Claude Code / Gemini CLI / OpenCode 的项目级一致)
- 不为 Cursor 单独引入 SSE transport 字段 (Cursor 原生 SSE 与 streamable HTTP 在配置上都用 `{ url, headers }`, 不区分)
- 不为 Cursor 的 `type: "sse"` / `type: "http"` 写入 explicit type 字段 (Cursor 文档示例不要求, 也不强制)

## Decisions

**D1: Cursor 走 wrapper-strategy, 不走 native env**
- 选项 A (本 change 采用): 复用 `gemini-cli.ts` 的 wrapper 策略 (env vars → `command: "env"` + `KEY=value` args)
- 选项 B: 走 Codex 那种 native `env = { ... }` 字段 (Cursor 实际也支持)
- 选 A 的原因: 与全局 "Adapter output format" requirement 保持一致; Codex 的 native 例外是因为 Windows `env` 不存在 + TUI 调试体验, Cursor 现阶段没有同等约束; 减少 fromAgentFormat 分支
- 后续: 如果用户反馈 Windows 下 Cursor wrapper 跑不起来, 再单独提 change 切换到 native env

**D2: 配置路径用项目级 `.cursor/mcp.json`, 不引入全局**
- isGlobal 设为 false, 与 Claude Code / Gemini CLI / OpenCode 一致
- detectAgents 通过 `existsSync(.cursor/mcp.json)` 命中

**D3: 注册顺序在 codex 之后, gemini-cli 之前 (按字母序)**
- `allAdapters` 数组在 `index.ts` 维持字母序: claude-code, codex, cursor, gemini-cli, opencode, antigravity, openclaw
- 影响 deploy 命令里 `choices` 列表的呈现顺序, 字母序对用户友好

## Risks / Trade-offs

- **Risk: Cursor 文档版本漂移** — Cursor 仍在快速迭代, 配置 schema 可能微调. mitigation: `fromAgentFormat` 已经容忍 `env` 字段同时存在 (legacy path), 即使将来 Cursor 在 wrapper 之外加 `env` 字段也能读回
- **Trade-off: wrapper 策略对 Windows 下的 Cursor 用户不友好** — 见 D1, 暂可接受, 跟 Gemini CLI 同水平

## Migration Plan

无需迁移. 本 change 是纯加法:
- 已有 mcpsmgr 用户不受影响
- 已有 `.cursor/mcp.json` 的项目, 升级 mcpsmgr 后下次 `deploy` 会自动检测并提供 Cursor 选项
- 全局配置 `~/.cursor/mcp.json` 不在 detect 路径上, 不会被误改

## Open Questions

- 是否要在 `install/local-json.ts` 的 sniffer 里加入 Cursor 的 fromAgentFormat? 当前 Cursor 文件结构和 Claude Code (`mcpServers` + `command/args/env`) 相同, sniffer 的 mcpServers 分支已经覆盖, 不需要单独加
