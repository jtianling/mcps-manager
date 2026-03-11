## 1. 收集已选中 agent 的现有服务名

- [x] 1.1 在 `src/commands/init.ts` 中, agent 选择完成后, 遍历已选中的 agent 调用 `read(projectDir)` 收集所有已存在的服务名到 `Set<string>`, read() 失败时静默跳过
- [x] 1.2 修改服务器 checkbox 的 `checked` 属性, 从硬编码 `true` 改为根据服务名是否在 detected set 中决定
- [x] 1.3 为已检测到的服务在 checkbox 显示名称中添加 `(detected)` 标签

## 2. 验证

- [x] 2.1 在有已配置 MCP 服务的项目目录 (如 `~/workspace/coworkspace`) 手动测试, 验证已存在的服务默认选中且标记 `(detected)`, 不存在的服务默认不选中
- [x] 2.2 在无任何 agent 配置的空目录测试, 验证所有服务默认不选中
