## 1. 工具函数

- [x] 1.1 在 `src/utils/` 下创建 `prompt.ts`, 实现 `isUserCancellation(error): boolean` 函数, 通过检测 `ExitPromptError` (从 `@inquirer/prompts` 导入) 判断是否为用户主动取消

## 2. 命令改造

- [x] 2.1 在 `src/commands/init.ts` 的 action handler 中添加 try-catch, 捕获 ExitPromptError 后静默 return
- [x] 2.2 在 `src/commands/setup.ts` 的 action handler 中添加 try-catch, 捕获 ExitPromptError 后静默 return
- [x] 2.3 在 `src/commands/add.ts` 的 action handler 中添加 try-catch, 捕获 ExitPromptError 后静默 return
- [x] 2.4 在 `src/commands/remove.ts` 的 action handler 中添加 try-catch, 捕获 ExitPromptError 后静默 return
- [x] 2.5 在 `src/commands/server-add.ts` 的 action handler 中添加 try-catch, 捕获 ExitPromptError 后静默 return
- [x] 2.6 在 `src/commands/sync.ts` 的 action handler 中添加 try-catch, 捕获 ExitPromptError 后静默 return

## 3. 验证

- [x] 3.1 构建项目确认无编译错误
- [x] 3.2 手动测试: 在各命令的 prompt 中按 Ctrl-C, 确认静默退出且退出码为 0
