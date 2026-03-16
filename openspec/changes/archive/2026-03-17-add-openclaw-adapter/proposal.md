## Why

mcps-manager 当前支持 5 个 agent 的 MCP 配置管理, 但不支持 OpenClaw. OpenClaw 是一个流行的开源 AI 助手 (GitHub 68k+ stars), 支持 MCP 协议连接本地工具, 用户需要统一管理其 MCP 配置.

## What Changes

- 新增 OpenClaw 适配器, 支持读写 `~/.openclaw/openclaw.json` (全局级, JSON5 格式)
- 引入 `json5` npm 依赖用于解析 OpenClaw 的 JSON5 配置文件
- 在 `AgentId` 类型中新增 `"openclaw"` 选项
- 适配器注册到全局列表, 自动参与检测/init/sync 等流程

## Capabilities

### New Capabilities

- `openclaw-adapter`: OpenClaw agent 的 MCP 配置适配器, 处理 JSON5 格式的全局配置文件

### Modified Capabilities

- `agent-adapters`: 新增 OpenClaw Adapter requirement, 更新 Agent 自动检测逻辑以包含 OpenClaw

## Impact

- `src/types.ts`: AgentId 联合类型扩展
- `src/adapters/`: 新增 `openclaw.ts` 适配器文件
- `src/adapters/index.ts`: 注册新适配器
- `package.json`: 新增 `json5` 依赖
- 测试文件需要覆盖新适配器
