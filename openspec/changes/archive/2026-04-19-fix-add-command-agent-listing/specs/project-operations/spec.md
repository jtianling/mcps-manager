## MODIFIED Requirements

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
