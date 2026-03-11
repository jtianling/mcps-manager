## Why

`mcpsmgr init` 命令在展示服务器选择列表时, 所有服务器默认全部选中 (`checked: true`). 但正确行为应该是: 读取目标目录中已选中 agent 的实际 MCP 配置, 仅对已存在的服务标记为 `(detected)` 并默认选中, 不存在的服务默认不选中.

## What Changes

- 修改 `init` 命令的服务器选择逻辑, 在展示 checkbox 前先读取已选中 agent 的现有配置
- 对于目标目录中已存在的 MCP 服务, 显示 `(detected)` 标签并默认选中
- 对于目标目录中不存在的 MCP 服务, 默认不选中

## Capabilities

### New Capabilities

(无新增能力)

### Modified Capabilities

- `project-operations`: 修改 `init` 命令的服务器选择默认状态逻辑, 从 "全部选中" 改为 "基于目标目录实际配置检测"

## Impact

- 受影响文件: `src/commands/init.ts`
- 可能需要利用 `AgentAdapter.read()` 方法读取各 agent 的现有配置
- 不涉及 API 变更, 不涉及新依赖
