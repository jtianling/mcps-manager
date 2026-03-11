## 1. 修改 checkbox 默认选中逻辑

- [x] 1.1 修改 `src/commands/add.ts` 中 checkbox 的 checked 逻辑, 当 `adapter.isGlobal` 为 `true` 时设为 `false`
- [x] 1.2 修改 `src/commands/remove.ts` 中 checkbox 的 checked 逻辑, 当 `adapter.isGlobal` 为 `true` 时设为 `false`
- [x] 1.3 修改 `src/commands/init.ts` 中 agent 选择 checkbox 的 checked 逻辑, 当 `adapter.isGlobal` 为 `true` 时设为 `false` (覆盖检测结果)

## 2. 更新 Spec

- [x] 2.1 更新 `openspec/specs/project-operations/spec.md`, 补充全局 agent 默认不选中的行为描述
