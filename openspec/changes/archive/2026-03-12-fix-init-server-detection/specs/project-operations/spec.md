## MODIFIED Requirements

### Requirement: 项目初始化

系统 SHALL 支持 `mcpsmgr init` 命令, 在当前项目中交互式选择 agent 和 MCP 服务.

#### Scenario: 交互式初始化

- **WHEN** 用户在项目目录执行 `mcpsmgr init`
- **THEN** 系统自动检测已存在的 agent 配置文件并预选 (其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中), 展示所有支持的 agent 供用户勾选, 从中央仓库列出所有已保存的 MCP 服务供用户勾选, 展示即将执行的操作预览, 确认后将选中的服务写入选中的 agent 配置文件

#### Scenario: 服务器选择默认状态基于目标目录检测

- **WHEN** 用户完成 agent 选择后进入服务器选择步骤
- **THEN** 系统 SHALL 读取所有已选中 agent 的现有配置, 收集已存在的 MCP 服务名称. 对于已存在于任一已选中 agent 配置中的服务, SHALL 标记为 `(detected)` 并默认选中. 对于不存在于任何已选中 agent 配置中的服务, SHALL 默认不选中.

#### Scenario: 配置读取失败降级

- **WHEN** 读取某个已选中 agent 的现有配置时发生错误 (如文件损坏)
- **THEN** 系统 SHALL 跳过该 agent 的服务检测, 继续处理其他 agent, 不阻断初始化流程

#### Scenario: 中央仓库为空

- **WHEN** 用户执行 `mcpsmgr init` 但 `~/.mcps-manager/servers/` 下没有任何服务
- **THEN** 系统提示中央仓库为空, 建议先使用 `mcpsmgr server add` 添加服务
