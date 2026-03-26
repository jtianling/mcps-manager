## MODIFIED Requirements

### Requirement: 列出项目 MCP 状态

系统 SHALL 支持 `mcpsmgr list --deployed` 命令, 展示当前项目各 agent 的 MCP 服务状态矩阵.

#### Scenario: 状态矩阵展示

- **WHEN** 用户在项目目录执行 `mcpsmgr list --deployed`
- **THEN** 系统扫描所有 agent 的实际配置文件, 解析出已配置的 MCP 服务, 以表格形式展示 (行: 服务名, 列: agent 名, 值: 是否存在及 transport 类型)

#### Scenario: 无 agent 配置文件

- **WHEN** 项目中没有任何 agent 配置文件且用户执行 `mcpsmgr list --deployed`
- **THEN** 系统提示未检测到任何 agent 配置, 建议执行 `mcpsmgr init`

## ADDED Requirements

### Requirement: 项目初始化空仓库提示

系统 SHALL 在中央仓库为空时给出正确的提示命令.

#### Scenario: 中央仓库为空

- **WHEN** 用户执行 `mcpsmgr init` 但 `~/.mcps-manager/servers/` 下没有任何服务
- **THEN** 系统提示中央仓库为空, 建议先使用 `mcpsmgr install` 添加服务

### Requirement: 项目移除服务提示

系统 SHALL 在服务不存在时给出正确的提示信息.

#### Scenario: 服务不存在于中央仓库

- **WHEN** 用户执行 `mcpsmgr add nonexistent`
- **THEN** 系统报错, 提示服务不存在于中央仓库, 建议使用 `mcpsmgr install` 安装
