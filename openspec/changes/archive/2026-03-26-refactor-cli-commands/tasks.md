## 1. CLI 命令重命名与重组

- [x] 1.1 将 `src/commands/server-add.ts` 重命名为 `src/commands/install.ts`, 导出函数名从 `serverAddCommand` 改为 `installCommand`
- [x] 1.2 将 `src/commands/server-remove.ts` 重命名为 `src/commands/uninstall.ts`, 导出函数名从 `serverRemoveCommand` 改为 `uninstallCommand`
- [x] 1.3 删除 `src/commands/server-list.ts`, 将其列出中央仓库的逻辑合并到 `src/commands/list.ts`
- [x] 1.4 修改 `src/commands/list.ts`: 默认行为改为列出中央仓库服务, 添加 `--deployed` flag 保留原有项目级矩阵展示
- [x] 1.5 重写 `src/index.ts`: 移除 `server` 子命令, 注册 `install`, `uninstall`, 更新 `list` 命令注册

## 2. 新增 custom-install 命令

- [x] 2.1 创建 `src/commands/custom-install.ts`, 实现从本地 JSON 文件安装 MCP 服务到中央仓库
- [x] 2.2 实现 JSON 文件验证逻辑: 检查 name, default.transport, default.command/default.url 字段
- [x] 2.3 实现同名冲突检测: 已存在时提示覆盖, 支持 `--force` flag 直接覆盖
- [x] 2.4 实现无文件或无参数时的交互式手动配置模式 (复用 install 中已有的手动配置逻辑)
- [x] 2.5 在 `src/index.ts` 中注册 `custom-install` 命令, 别名 `ci`

## 3. 新增 update 命令

- [x] 3.1 创建 `src/commands/update.ts`, 实现根据 source URL 重新分析更新服务配置
- [x] 3.2 实现单个服务更新流程: 读取 source → GLM 分析 → 差异比对 → 展示预览 → 确认更新
- [x] 3.3 实现 env 值保留逻辑: 更新时保留旧配置中已有 env key 的值
- [x] 3.4 实现批量更新: 无参数时遍历所有服务, 跳过 source 为空或 `local` 的, 单个失败不中断
- [x] 3.5 在 `src/index.ts` 中注册 `update` 命令

## 4. 提示信息更新

- [x] 4.1 更新 `src/commands/init.ts` 中央仓库为空时的提示: `mcpsmgr server add` → `mcpsmgr install`
- [x] 4.2 更新 `src/commands/add.ts` 服务不存在时的提示: 建议使用 `mcpsmgr install`
- [x] 4.3 更新 `src/commands/list.ts` (deployed 模式) 无 agent 时的提示保持不变

## 5. 测试与文档

- [x] 5.1 更新 `src/__tests__/integration.test.ts` 中涉及 `server add/remove/list` 的测试用例
- [x] 5.2 为 custom-install 添加测试: 文件安装, 交互模式, 同名冲突, --force
- [x] 5.3 为 update 添加测试: 单个更新, 批量更新, source 为 local 跳过, env 保留
- [x] 5.4 为 list --deployed 添加测试
- [x] 5.5 更新 README.md 的命令文档
