## Context

mcps-manager 支持 5 个 agent adapter, 其中 Antigravity 的 `isGlobal` 为 `true`, 配置文件位于 `~/.gemini/antigravity/mcp_config.json`. 由于全局配置文件几乎总是存在, `detectAgents()` 始终会检测到它, 导致在 `add`, `remove`, `init` 的交互式 checkbox 中默认选中.

当前三个命令的 checked 逻辑:
- `add.ts`: 所有 detected agent 都 `checked: true`
- `remove.ts`: 所有含该 server 的 agent 都 `checked: true`
- `init.ts`: detected agent `checked: true`, 其余 `checked: false`

## Goals / Non-Goals

**Goals:**
- 全局 agent 在交互式选择中默认不选中, 需要用户主动勾选
- 保持非全局 agent 的默认选中行为不变
- 确认 remove 只删除单个 MCP 配置, 不会批量删除 agent 下所有 MCP

**Non-Goals:**
- 不改变 `detectAgents()` 的检测逻辑
- 不改变 `isGlobal` 属性的含义
- 不改变 sync 命令的行为 (sync 不涉及 checkbox 选择)

## Decisions

### Decision 1: 使用 `adapter.isGlobal` 控制 checked 默认值

在所有 checkbox 的 choices 构建中, 当 `adapter.isGlobal === true` 时, `checked` 设为 `false`.

这是最简洁的方案, 直接复用已有的 `isGlobal` 属性, 无需新增字段或配置.

备选方案:
- 新增 `defaultChecked` 属性: 过度设计, 当前只有全局 agent 需要默认不选中
- 在 `detectAgents()` 中过滤全局 agent: 会影响其他依赖检测结果的逻辑

### Decision 2: 保持 remove 的单 MCP 删除语义不变

当前 `remove` 命令接收一个 `serverName` 参数, 只删除该 server 在选中 agent 中的配置. 这已经满足"不整体删除某个 agent 的所有 MCP"的要求, 无需修改逻辑, 只需调整默认选中行为.

## Risks / Trade-offs

- [全局 agent 容易被忽略] → checkbox 中 `[global]` 标签已提供视觉提示, 用户不会遗漏
- [用户习惯变更] → 改进方向明确, 避免误操作全局配置, 用户应该欢迎此变更
