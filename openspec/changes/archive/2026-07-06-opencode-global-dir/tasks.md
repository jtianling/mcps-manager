## 1. 实现

- [x] 1.1 `src/adapters/opencode.ts`: 增加 `globalDir: () => join(homedir(), ".config", "opencode")`
- [x] 1.2 测试: opencode `globalDir()` 单测; add 命令 `-a opencode --global` 写入全局目录; 不支持 `--global` 的报错测试从 opencode 换为 gemini-cli

## 2. 收尾

- [x] 2.1 `index.ts` --help 与 README 的 "currently codex only" 文案更新为 codex + opencode; 全量 `npm test` + `npm run build` 通过
