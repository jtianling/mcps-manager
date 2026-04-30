## Why

mcpsmgr 当前支持 Claude Code, Codex, Gemini CLI, OpenCode, Antigravity, OpenClaw 共 6 个 agent (其中 OpenClaw 较新), 但缺失 Cursor. Cursor 是当前主流的 AI IDE, 已原生支持 MCP, 项目级配置位于 `.cursor/mcp.json` (全局位于 `~/.cursor/mcp.json`). 用户希望把中央仓库的 MCP server 一并部署到 Cursor.

## What Changes

- 新增 Cursor 适配器, 操作 `.cursor/mcp.json` (项目级, JSON 格式, 顶层 `mcpServers`)
- Cursor 的 MCP 配置格式与 Gemini CLI 几乎一致: stdio 写 `{ command, args }`, HTTP 写 `{ url, headers }`, 无 `type` 字段, transport 由是否含 `command` 或 `url` 推断
- 在 `AgentId` 类型中新增 `"cursor"`
- 适配器注册到全局列表, 自动参与 detect/add/deploy/list/remove 等流程
- agent-adapters spec 新增 Cursor Adapter requirement, 修改 Agent 自动检测 scenario 加入 `.cursor/mcp.json`

## Capabilities

### New Capabilities

(无, 新 adapter 通过 agent-adapters spec 表达)

### Modified Capabilities

- `agent-adapters`: ADDED Cursor Adapter requirement; MODIFIED Agent 自动检测 scenario, 加入 `.cursor/mcp.json` 探测路径

## Impact

- 代码: `src/types.ts` (AgentId 联合扩展), `src/adapters/cursor.ts` (新建), `src/adapters/index.ts` (注册)
- 测试: `src/adapters/__tests__/adapters.test.ts` (新增 Cursor Adapter describe block)
- 文档: `README.md`, `docs/README_zh-CN.md` (Supported Agents 表 + Features 列表 + Solution 图)
- 规范: `openspec/specs/agent-adapters/spec.md` (Purpose 数量, Cursor Adapter requirement, Agent 自动检测 scenario)
- 依赖: 无新增 (复用 `json-file.ts` 与 `env-args.ts`)
- 用户影响: 在已有 `.cursor/mcp.json` 的项目中, `mcpsmgr deploy` 自动检测 Cursor; 旧用户数据无破坏
