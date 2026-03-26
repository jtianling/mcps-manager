## Context

当前 mcpsmgr 使用 `server add/remove/list` 子命令管理中央仓库, 与项目级 `add/remove/list` 形成两层命名空间. 对比 skillsmgr 已验证的 `install/uninstall` + `add/remove` 模式, 当前设计增加了不必要的认知负担. 同时缺少本地安装和更新能力.

现有文件结构:
- `src/commands/server-add.ts` → 中央仓库添加 (含 GLM AI 分析)
- `src/commands/server-remove.ts` → 中央仓库移除
- `src/commands/server-list.ts` → 中央仓库列表
- `src/commands/list.ts` → 项目级列表
- `src/index.ts` → CLI 注册 (使用 `server` 子命令)

## Goals / Non-Goals

**Goals:**
- 将 CLI 命令层级从 `server add/remove/list` 扁平化为 `install/uninstall`
- 合并 `list` 命令, 默认展示中央仓库, `--deployed` 展示项目级
- 新增 `custom-install` (别名 `ci`) 支持从本地手动安装 MCP 服务
- 新增 `update` 命令支持根据 source 重新分析更新配置
- 保持所有项目级命令 (`init/add/remove/sync`) 行为不变

**Non-Goals:**
- 不改变 adapter 层的实现
- 不改变 GLM 分析服务的实现
- 不改变服务定义的 JSON 结构 (ServerDefinition 已有 source 字段)
- 不实现 git clone 方式的安装 (与 skillsmgr 不同, mcpsmgr 基于 AI 分析而非文件复制)

## Decisions

### D1: 命令重命名映射

| 旧命令 | 新命令 | 理由 |
|--------|--------|------|
| `server add [source]` | `install [source]` | 符合包管理器惯例 (npm install, brew install) |
| `server remove <name>` | `uninstall <name>` | 与 install 配对, 语义清晰 |
| `server list` + `list` | `list [--deployed]` | 用 flag 区分两个视角, 减少命令数量 |

替代方案: 保留 `server` 子命令但重命名. 放弃原因: 多一层子命令没有实际收益, 且与 skillsmgr 不一致.

### D2: custom-install 设计

`custom-install <name>` 将当前工作目录下的一个本地 MCP 服务定义文件安装到中央仓库. 用户需在当前目录准备好一个 `<name>.json` 文件, 格式与 ServerDefinition 一致. 命令将其复制到 `~/.mcps-manager/servers/`.

替代方案: 类似 skillsmgr 从子目录安装. 放弃原因: mcpsmgr 管理的是 JSON 配置而非 markdown 文件, 直接复制 JSON 更贴合场景.

也支持通过交互式引导创建: 如果不提供 name 参数或指定的文件不存在, 进入与当前 `server add` 手动模式相同的交互流程, 但 source 标记为 `local`.

### D3: update 命令设计

`update [name]` 重新分析已安装服务的 source URL, 用 GLM 获取最新配置. 流程:
1. 无参数: 遍历中央仓库所有有 source 的服务
2. 有参数: 只更新指定服务
3. 对每个服务: 调用 GLM 重新分析 source URL
4. 比对 default 配置差异, 展示变更预览
5. 用户确认后更新, 保留用户自定义的 env 值

替代方案: 直接覆盖. 放弃原因: 可能丢失用户手动配置的环境变量值.

### D4: list 合并策略

- `list` (默认): 展示 `~/.mcps-manager/servers/` 中所有已安装服务, 包含 name, source, transport
- `list --deployed`: 展示当前项目各 agent 的 MCP 服务矩阵 (即原 `list` 的行为)

### D5: 文件重命名

| 旧文件 | 新文件 |
|--------|--------|
| `src/commands/server-add.ts` | `src/commands/install.ts` |
| `src/commands/server-remove.ts` | `src/commands/uninstall.ts` |
| `src/commands/server-list.ts` | 删除, 逻辑合并到 `list.ts` |
| — | `src/commands/custom-install.ts` (新增) |
| — | `src/commands/update.ts` (新增) |

## Risks / Trade-offs

- **BREAKING 变更**: 所有使用 `mcpsmgr server *` 的用户需要迁移 → 项目处于 0.x 阶段, 用户量极少, 可接受
- **update 依赖外部服务**: GLM 分析可能因 API 变更或网络问题失败 → 失败时跳过并报告, 不中断整体流程
- **custom-install 文件格式**: 要求用户手写 ServerDefinition JSON → 可提供 example 文件或在文档中说明格式
