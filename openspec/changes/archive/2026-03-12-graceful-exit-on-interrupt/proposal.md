## Why

用户在 `init`, `setup`, `add`, `remove`, `server-add`, `sync` 等交互式命令中按 Ctrl-C 或 q 退出时, 程序会抛出未捕获的 `AbortError` 异常并显示错误堆栈, 体验不好.  应该静默退出, 不输出任何错误信息.

## What Changes

- 所有使用 `@inquirer/prompts` 的交互式命令统一捕获用户中断 (`AbortError`)
- 捕获后静默退出, 进程退出码为 0 (正常退出)
- 不改变任何已有的业务逻辑

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `project-operations`: init, add, remove, sync 命令需要支持用户中断时的优雅退出
- `server-management`: server-add 命令需要支持用户中断时的优雅退出

## Impact

- 影响文件: `src/commands/init.ts`, `src/commands/setup.ts`, `src/commands/add.ts`, `src/commands/remove.ts`, `src/commands/server-add.ts`, `src/commands/sync.ts`
- 不影响 API, 依赖或外部系统
