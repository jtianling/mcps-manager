## Context

mcps-manager 使用适配器模式管理多个 agent 的 MCP 配置. 当前有 5 个适配器, 其中 Antigravity 是唯一的全局级适配器. OpenClaw 将成为第二个全局级适配器, 配置文件位于 `~/.openclaw/openclaw.json`, 使用 JSON5 格式.

## Goals / Non-Goals

**Goals:**

- 为 OpenClaw 实现完整的 AgentAdapter, 支持 stdio 和 http 两种传输协议
- 使用 `json5` 库解析 OpenClaw 的 JSON5 配置文件, 正确处理注释和尾逗号
- OpenClaw 适配器参与所有现有工作流 (init, add, remove, sync, list)

**Non-Goals:**

- 不支持 OpenClaw 的 YAML 配置格式 (仅用于 self-hosted 部署场景)
- 不支持 OpenClaw 的 per-agent 级别 MCP 配置 (YAML 格式中的 `agents[].mcp_servers`)

## Decisions

### 1. 配置文件路径: `~/.openclaw/openclaw.json`

OpenClaw 的主配置文件是 `~/.openclaw/openclaw.json`, 这是全局配置. MCP 服务器定义在 `mcpServers` 顶层键下, 格式与 Claude Desktop / Antigravity 几乎一致.

选择理由: 这是 OpenClaw 的标准配置路径, 也是大多数用户使用的方式.

备选: `~/.openclaw/mcp_config.json` (独立 MCP 配置文件) - 但这不是主流方式.

### 2. JSON5 读取, 标准 JSON 写入

- 读取时使用 `json5` 库解析, 兼容用户手写的注释和尾逗号
- 写入时使用标准 `JSON.stringify` 输出, 因为 JSON 是 JSON5 的子集, 保证兼容性
- 新建 `json5-file.ts` 工具模块, 提供 `readJson5File` / `writeJson5File` 函数, 与现有 `json-file.ts` 保持对称

选择理由: 引入 `json5` 包体积小 (~8KB), 且能正确处理用户手写的带注释配置. 写入用标准 JSON 是因为: (a) JSON5 向下兼容 JSON, (b) 避免引入 JSON5 序列化逻辑.

备选方案 A: 只用标准 JSON.parse - 会在用户手写注释时失败.
备选方案 B: 用正则剥离注释后解析 - 容易出错, 不够稳健.

### 3. env 字段处理: 与 Antigravity 一致

OpenClaw 的 `mcpServers` 格式与 Antigravity 相同: `{ command, args, env }`. 采用相同的 env 处理策略:

- 写入时: 使用 `env` command wrapper 方式, 不输出 `env` 字段
- 读取时: 支持 `env` command wrapper 和 legacy `env` 字段两种格式

### 4. HTTP 传输: url 字段名为 `url`

OpenClaw 的 HTTP 传输使用 `url` 字段 (不同于 Antigravity 的 `serverUrl`).

```
OpenClaw:     { "url": "...", "headers": {...} }
Antigravity:  { "serverUrl": "...", "headers": {...} }
```

### 5. isGlobal: true

OpenClaw 适配器标记为全局级, configPath 不依赖 projectDir 参数. 检测逻辑与 Antigravity 一致: 检查全局配置文件是否存在.

## Risks / Trade-offs

- **写入会丢失用户注释**: JSON.stringify 写入后, 用户在 `openclaw.json` 中手写的注释会被清除. 这是已知的 trade-off, 因为实现注释保留需要完整的 JSON5 AST 操作, 复杂度过高. → 可在文档中提示用户.
- **JSON5 依赖**: 引入新的 npm 依赖. → json5 是成熟稳定的包, 无安全风险.
