## MODIFIED Requirements

### Requirement: 项目初始化

系统 SHALL 支持 `mcpsmgr init` 命令, 在当前项目中交互式选择 agent 和 MCP 服务.

#### Scenario: 交互式初始化

- **WHEN** 用户在项目目录执行 `mcpsmgr init`
- **THEN** 系统自动检测已存在的 agent 配置文件并预选, 展示所有支持的 agent 供用户勾选, 其中 `isGlobal` 为 `true` 的 agent (如 Antigravity) SHALL 默认不选中, 非全局 agent 按检测结果预选, 从中央仓库列出所有已保存的 MCP 服务供用户勾选, 展示即将执行的操作预览, 确认后将选中的服务写入选中的 agent 配置文件

#### Scenario: 中央仓库为空

- **WHEN** 用户执行 `mcpsmgr init` 但 `~/.mcps-manager/servers/` 下没有任何服务
- **THEN** 系统提示中央仓库为空, 建议先使用 `mcpsmgr server add` 添加服务

### Requirement: 项目添加服务

系统 SHALL 支持 `mcpsmgr add <server-name>` 命令, 将中央仓库中的服务添加到当前项目的 agent 配置中.

#### Scenario: 添加到已检测的 agent

- **WHEN** 用户执行 `mcpsmgr add context7`
- **THEN** 系统自动检测项目中已存在的 agent 配置文件, 展示列表供用户勾选, 其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中, 非全局 agent 默认选中, 将服务写入勾选的 agent 配置文件

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
- **THEN** 系统列出包含该服务的所有 agent 配置, 供用户勾选要移除的, 其中 `isGlobal` 为 `true` 的 agent SHALL 默认不选中, 非全局 agent 默认选中, 从勾选的 agent 配置文件中删除该服务条目, 保留文件中的其他内容

#### Scenario: 无 agent 包含该服务

- **WHEN** 用户执行 `mcpsmgr remove nonexistent` 但没有任何 agent 配置包含该服务
- **THEN** 系统提示未在任何 agent 配置中找到该服务

#### Scenario: 取消选中 agent 不删除 MCP

- **WHEN** 用户在 remove 交互中取消选中某个 agent
- **THEN** 系统 SHALL NOT 删除该 agent 中的任何 MCP 配置, 仅跳过该 agent
