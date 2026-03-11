## ADDED Requirements

### Requirement: server-add 交互中断优雅退出

`mcpsmgr server add` 命令 SHALL 在用户按 Ctrl-C 中断任意 prompt 时正常退出, 不输出错误信息, 退出码为 0.

#### Scenario: 自动模式中按 Ctrl-C

- **WHEN** 用户在 `mcpsmgr server add <url>` 的 GLM 分析确认或环境变量输入 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不保存任何服务配置, 进程退出码为 0

#### Scenario: 手动模式中按 Ctrl-C

- **WHEN** 用户在手动配置模式的任意 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不输出错误堆栈, 不保存任何服务配置, 进程退出码为 0
