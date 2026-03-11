## Why

Antigravity 因为是全局 agent (配置文件始终存在于 `~/.gemini/antigravity/`), 在自动检测时 100% 会被检测到并默认选中. 这导致用户在 `add`, `remove`, `init` 等交互中, 每次都会不经意地操作 Antigravity 的全局配置. 需要改为默认不选中全局 agent, 让用户主动勾选.

此外, 取消选中某个 agent 时不应删除任何 MCP. 只有在选中某个 agent 的前提下, 再取消某个具体 MCP, 才会删除该 MCP 的配置. 不存在"整体删除某个 agent 的所有 MCP"的场景.

## What Changes

- 所有交互式 checkbox 中, `isGlobal` 为 `true` 的 agent 默认不选中 (checked: false)
- `remove` 命令中, 全局 agent 也默认不选中, 需要用户主动勾选才执行删除
- 确认 `remove` 的逻辑是逐个 MCP 删除, 不会批量删除某个 agent 下所有 MCP (当前实现已满足, 仅需调整默认选中行为)

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `project-operations`: init/add/remove 命令中全局 agent 的默认选中行为变更, 全局 agent 默认不选中

## Impact

- `src/commands/add.ts`: checkbox 的 checked 逻辑
- `src/commands/remove.ts`: checkbox 的 checked 逻辑
- `src/commands/init.ts`: checkbox 的 checked 逻辑
- `openspec/specs/project-operations/spec.md`: 更新 spec 中关于全局 agent 默认选中行为的描述
