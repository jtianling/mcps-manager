## MODIFIED Requirements

### Requirement: 项目初始化

系统 SHALL 支持 `mcpsmgr deploy` 命令, 在当前项目中交互式选择 agent 和 MCP 服务.

#### Scenario: 交互式初始化

- **WHEN** 用户在项目目录执行 `mcpsmgr deploy`
- **THEN** 系统自动检测已存在的 agent 配置文件并预选 (其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中), 展示所有支持的 agent 供用户勾选, 从中央仓库列出所有已保存的 MCP 服务供用户勾选, 展示即将执行的操作预览, 确认后将选中的服务写入选中的 agent 配置文件. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 服务器选择默认状态基于目标目录检测

- **WHEN** 用户完成 agent 选择后进入服务器选择步骤
- **THEN** 系统 SHALL 读取所有已选中 agent 的现有配置, 收集已存在的 MCP 服务名称. 对于已存在于任一已选中 agent 配置中的服务, SHALL 标记为 `(detected)` 并默认选中. 对于不存在于任何已选中 agent 配置中的服务, SHALL 默认不选中.

#### Scenario: 配置读取失败降级

- **WHEN** 读取某个已选中 agent 的现有配置时发生错误 (如文件损坏)
- **THEN** 系统 SHALL 跳过该 agent 的服务检测, 继续处理其他 agent, 不阻断初始化流程

#### Scenario: 中央仓库为空

- **WHEN** 用户执行 `mcpsmgr deploy` 但 `~/.mcps-manager/servers/` 下没有任何服务
- **THEN** 系统提示中央仓库为空, 建议先使用 `mcpsmgr install` 添加服务

### Requirement: 项目添加服务

系统 SHALL 支持 `mcpsmgr add <server-name>` 命令, 将中央仓库中的服务添加到当前项目的 agent 配置中.

#### Scenario: 添加到已检测的 agent

- **WHEN** 用户执行 `mcpsmgr add context7`
- **THEN** 系统自动检测项目中已存在的 agent 配置文件, 展示列表供用户勾选 (其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中), 将服务写入勾选的 agent 配置文件. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 服务不存在于中央仓库

- **WHEN** 用户执行 `mcpsmgr add nonexistent`
- **THEN** 系统报错, 提示服务不存在于中央仓库

#### Scenario: 部分 agent 同名冲突

- **WHEN** 添加时某些 agent 配置文件中已存在同名服务
- **THEN** 系统对冲突的 agent 报告跳过, 对无冲突的 agent 正常写入

### Requirement: 项目移除服务

系统 SHALL 支持 `mcpsmgr remove <server-name>` 命令, 从当前项目的 agent 配置中移除单个 MCP 服务配置.

#### Scenario: 从多个 agent 移除

- **WHEN** 用户执行 `mcpsmgr remove brave-search`
- **THEN** 系统列出包含该服务的所有 agent 配置, 供用户勾选要移除的 (其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中), 从勾选的 agent 配置文件中删除该服务条目, 保留文件中的其他内容. 未勾选的 agent SHALL NOT 被删除任何 MCP 配置. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 无 agent 包含该服务

- **WHEN** 用户执行 `mcpsmgr remove nonexistent` 但没有任何 agent 配置包含该服务
- **THEN** 系统提示未在任何 agent 配置中找到该服务

#### Scenario: 取消选中 agent 不删除 MCP

- **WHEN** 用户在 remove 交互中取消选中某个 agent
- **THEN** 系统 SHALL NOT 删除该 agent 中的任何 MCP 配置, 仅跳过该 agent
