## Why

mcpsmgr 的命令命名需要与 skillsmgr 对齐, 保持两个工具的用户体验一致. 目前 mcpsmgr 用 `init` 表示 "部署到项目", skillsmgr 用 `deploy`; mcpsmgr 用独立的 `sync` 命令, skillsmgr 用 `deploy --refresh`. 统一命名可以降低在两个工具间切换的认知成本.

## What Changes

- **BREAKING**: `mcpsmgr init` 重命名为 `mcpsmgr deploy`
- **BREAKING**: `mcpsmgr sync` 合并为 `mcpsmgr deploy --refresh`
- `sync` 命令文件移除, 其逻辑合并到 `deploy` 命令中
- spec 和错误提示中的命令引用同步更新

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `project-operations`: `init` 命令重命名为 `deploy`, `sync` 命令合并为 `deploy --refresh` flag

## Impact

- `src/commands/init.ts` → `src/commands/deploy.ts` (重命名)
- `src/commands/sync.ts` → 逻辑合并到 `src/commands/deploy.ts`
- `src/index.ts` 命令注册更新
- `openspec/specs/project-operations/spec.md` 中的命令引用更新
