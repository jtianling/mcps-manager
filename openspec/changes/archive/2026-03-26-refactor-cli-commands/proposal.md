## Why

当前 CLI 使用 `server add/remove/list` 子命令管理中央仓库, 与项目级 `add/remove/list` 语义混淆. 同时缺少本地手动安装 (`custom-install`) 和更新 (`update`) 能力. 参照 skillsmgr 已验证的命令模式进行统一, 降低用户心智负担.

## What Changes

- **BREAKING**: 移除 `server` 子命令层级, `server add [source]` → `install <source>`, `server remove <name>` → `uninstall <name>`, `server list` → 合并到 `list` (默认列出已安装)
- **BREAKING**: `list` 默认展示中央仓库已安装的服务, 加 `--deployed` flag 展示项目级部署状态
- 新增 `custom-install <path>` 命令 (别名 `ci`), 从本地目录手动安装 MCP 服务定义到中央仓库
- 新增 `update [source]` 命令, 检测已安装服务的来源并拉取最新配置
- 中央仓库存储结构调整: 服务定义文件需记录 `source` 来源信息以支持 update
- `init` / `add` / `remove` / `sync` 项目级命令保持不变

## Capabilities

### New Capabilities
- `custom-install`: 从本地目录安装 MCP 服务定义到中央仓库, 支持 `--force` 覆盖
- `update-command`: 根据已记录的 source 信息重新分析并更新中央仓库中的服务配置

### Modified Capabilities
- `server-management`: CLI 命令从 `server add/remove/list` 改为 `install/uninstall`, list 行为变更
- `project-operations`: `list` 命令行为变更, 默认列出中央仓库, `--deployed` 列出项目级
- `central-storage`: 服务定义文件需存储 source 元数据以支持 update

## Impact

- `src/index.ts`: CLI 命令注册完全重写
- `src/commands/server-add.ts` → `src/commands/install.ts`: 重命名并调整
- `src/commands/server-remove.ts` → `src/commands/uninstall.ts`: 重命名并调整
- `src/commands/server-list.ts`: 删除, 功能合并到 `list.ts`
- `src/commands/list.ts`: 增加 `--deployed` flag, 默认行为改为列出中央仓库
- 新增 `src/commands/custom-install.ts`
- 新增 `src/commands/update.ts`
- `src/types.ts`: ServerDefinition 已有 source 字段, 需确认是否满足 update 需求
- README.md: 命令文档更新
- 现有 specs 中引用 `mcpsmgr server add/remove/list` 的场景需同步更新
