## Purpose

提供项目级的 MCP 服务管理操作, 包括部署, 添加, 移除, 刷新同步和状态查看.
## Requirements
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

#### Scenario: 列出所有已知 agent 供选择

- **WHEN** 用户执行 `mcpsmgr add context7`
- **THEN** 系统 SHALL 展示所有已知 agent 的勾选列表 (与 `mcpsmgr deploy` 相同的全集), 对项目目录下配置文件已存在的 agent SHALL 标注 `(detected)` 后缀. 对标注为 `(detected)` 且 `isGlobal` 为 `false` 的 agent SHALL 默认勾选; 其余 (未检测 / 全局) SHALL 默认不勾选但保留可手动勾选的能力. 将服务写入勾选的 agent 配置文件, 如目标 agent 的配置文件不存在则 SHALL 由 adapter 创建. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 服务不存在于中央仓库

- **WHEN** 用户执行 `mcpsmgr add nonexistent`
- **THEN** 系统报错, 提示服务不存在于中央仓库

#### Scenario: 部分 agent 同名冲突

- **WHEN** 添加时某些 agent 配置文件中已存在同名服务
- **THEN** 系统对冲突的 agent 报告跳过, 对无冲突的 agent 正常写入

#### Scenario: 项目中无任何 agent 配置文件

- **WHEN** 用户在一个从未配置过任何 agent 的项目目录执行 `mcpsmgr add <server>`
- **THEN** 系统 SHALL 仍展示完整的 agent 勾选列表 (所有条目均不带 `(detected)` 标注, 默认均未勾选), 用户主动勾选后 SHALL 通过 adapter 写入对应 agent, 创建尚不存在的配置文件. 系统 SHALL NOT 因 "未检测到 agent" 而提前返回

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

### Requirement: 同步中央仓库变更

系统 SHALL 支持 `mcpsmgr deploy --refresh` 命令, 将中央仓库的服务配置同步到当前项目的 agent 配置文件.

#### Scenario: 同步更新

- **WHEN** 用户修改了中央仓库中的服务配置 (如更新了 API key) 后执行 `mcpsmgr deploy --refresh`
- **THEN** 系统读取各 agent 配置文件中已有的 MCP 服务, 与中央仓库比对, 展示变更预览, 用户确认后更新 agent 配置文件中对应服务的配置

#### Scenario: 同名冲突处理

- **WHEN** sync 过程中发现某个 agent 配置中的服务名与中央仓库同名但非 mcpsmgr 管理 (用户手动添加的)
- **THEN** 系统报告冲突, 跳过该服务在该 agent 的同步

### Requirement: 列出项目 MCP 状态

系统 SHALL 支持 `mcpsmgr list --deployed` 命令, 展示当前项目各 agent 的 MCP 服务状态矩阵.

#### Scenario: 状态矩阵展示

- **WHEN** 用户在项目目录执行 `mcpsmgr list --deployed`
- **THEN** 系统扫描所有 agent 的实际配置文件, 解析出已配置的 MCP 服务, 以表格形式展示 (行: 服务名, 列: agent 名, 值: 是否存在及 transport 类型)

#### Scenario: 无 agent 配置文件

- **WHEN** 项目中没有任何 agent 配置文件且用户执行 `mcpsmgr list --deployed`
- **THEN** 系统提示未检测到任何 agent 配置, 建议执行 `mcpsmgr deploy`

### Requirement: 交互中断优雅退出

所有项目级交互式命令 (deploy, add, remove) SHALL 在用户按 Ctrl-C 中断 prompt 时正常退出, 不输出错误信息, 退出码为 0.

#### Scenario: deploy 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr deploy` 的任意 prompt 步骤中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: deploy --refresh 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr deploy --refresh` 的确认 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: add 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr add <server>` 的 agent 选择 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: remove 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr remove <server>` 的 agent 选择 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

### Requirement: deploy 命令中取消勾选已检测服务触发删除

系统 SHALL 在 `mcpsmgr deploy` 中, 当用户取消勾选已检测到的 MCP 服务时, 将其视为删除意图, 在操作计划中展示并在确认后执行删除.

#### Scenario: 取消勾选已检测服务

- **WHEN** 用户在 `mcpsmgr deploy` 的服务选择步骤中, 取消勾选一个已被检测到 (标记为 `(detected)`) 的服务
- **THEN** 系统 SHALL 在操作计划中以 `- <server-name>` 格式展示该服务将被删除, 并在用户确认后, 从对应 agent 配置中移除该服务

#### Scenario: 仅从包含该服务的 agent 中删除

- **WHEN** 用户取消勾选一个已检测服务, 且多个已选 agent 中只有部分包含该服务
- **THEN** 系统 SHALL 仅从实际包含该服务的 agent 配置中执行删除, 不影响不包含该服务的 agent

### Requirement: 项目初始化空仓库提示

系统 SHALL 在中央仓库为空时给出正确的提示命令.

#### Scenario: 中央仓库为空

- **WHEN** 用户执行 `mcpsmgr deploy` 但 `~/.mcps-manager/servers/` 下没有任何服务
- **THEN** 系统提示中央仓库为空, 建议先使用 `mcpsmgr install` 添加服务

