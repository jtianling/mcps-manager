## MODIFIED Requirements

### Requirement: 交互中断优雅退出

所有项目级交互式命令 (init, add, remove, sync) SHALL 在用户按 Ctrl-C 中断 prompt 时正常退出, 不输出错误信息, 退出码为 0. `setup` 命令的场景在本 change 中被移除, 因为该命令整体不再存在.

#### Scenario: init 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr init` 的任意 prompt 步骤中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: add 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr add <server>` 的 agent 选择 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: remove 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr remove <server>` 的 agent 选择 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0

#### Scenario: sync 命令中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr sync` 的确认 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不修改任何配置文件, 进程退出码为 0
