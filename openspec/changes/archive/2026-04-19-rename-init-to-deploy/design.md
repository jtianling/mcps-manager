## Context

mcpsmgr 当前有 `init` 和 `sync` 两个独立命令处理项目级部署操作. skillsmgr 使用 `deploy` 和 `deploy --refresh` 的命名方式. 需要对齐命名以保持一致性.

当前文件结构:
- `src/commands/init.ts` — 导出 `initCommand()`, 负责交互式部署
- `src/commands/sync.ts` — 导出 `syncCommand()`, 负责同步中央仓库变更
- `src/index.ts` — Commander 注册 `init` 和 `sync` 两个独立命令

## Goals / Non-Goals

**Goals:**
- 将 `init` 命令重命名为 `deploy`
- 将 `sync` 命令合并为 `deploy --refresh`
- 更新所有 spec 中的命令引用

**Non-Goals:**
- 不添加 skillsmgr 中 mcpsmgr 没有的 flags (如 `--all`, `-y`, `--json` 等)
- 不改变 init/sync 的任何业务逻辑
- 不做向后兼容 alias (不保留旧的 `init`/`sync` 命令)

## Decisions

### D1: 文件重命名策略

将 `src/commands/init.ts` 重命名为 `src/commands/deploy.ts`, 同时将 `sync.ts` 的逻辑合并进来. 删除 `src/commands/sync.ts`.

理由: deploy 命令承担两种模式 (交互式部署 vs 刷新同步), 放在一个文件中更符合 "一个命令一个文件" 的现有约定.

### D2: Commander 注册方式

在 `src/index.ts` 中注册一个 `deploy` 命令, 带 `--refresh` option. 无 `--refresh` 时走原 init 逻辑, 有 `--refresh` 时走原 sync 逻辑.

### D3: 函数命名

- `initCommand()` → `deployCommand(options)`
- `syncCommand()` → 合并到 `deployCommand` 内部, 通过 `options.refresh` 分支

## Risks / Trade-offs

- [Breaking change] 用户已有的 shell alias 或脚本中的 `mcpsmgr init` / `mcpsmgr sync` 会失效 → 这是预期行为, 不做兼容
- [Spec drift] `project-operations/spec.md` 中大量引用 `init` 和 `sync` → 通过 delta spec 同步更新
