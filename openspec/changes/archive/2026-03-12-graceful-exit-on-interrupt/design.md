## Context

所有交互式命令 (init, setup, add, remove, server-add, sync) 使用 `@inquirer/prompts` 进行用户交互.  当用户按 Ctrl-C 时, inquirer 抛出 `ExitPromptError` 异常.  当前没有任何命令捕获此异常, 导致程序以错误堆栈退出.

## Goals / Non-Goals

**Goals:**
- 用户在任何交互式 prompt 中按 Ctrl-C 时, 程序静默正常退出
- 统一处理, 避免每个命令重复编写 try-catch

**Non-Goals:**
- 不添加 'q' 键退出 (inquirer 不原生支持, 且 q 可能是合法输入)
- 不改变业务逻辑或 prompt 行为
- 不处理非交互式命令的中断

## Decisions

### Decision 1: 统一工具函数捕获 ExitPromptError

提取一个 `isUserCancellation(error)` 工具函数, 判断错误是否为用户主动取消.  在各命令的顶层 action handler 中统一 try-catch, 捕获后静默 return.

**备选方案**: 在每个 prompt 调用处逐一 try-catch → 太冗余, 容易遗漏.

**备选方案**: 全局 process-level uncaughtException handler → 过于激进, 可能掩盖真实错误.

### Decision 2: 退出码为 0

用户主动取消是正常行为, 不是错误.  退出码应为 0.

## Risks / Trade-offs

- [Risk] 新增的 prompt 调用忘记包裹 → 通过在命令 action 顶层统一 catch 来规避, 只要命令内部抛出的 ExitPromptError 会自然冒泡到顶层
