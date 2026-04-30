## 1. Tests (RED)

- [x] 1.1 在 `src/adapters/__tests__/adapters.test.ts` 新增 `Cursor Adapter` describe block, 覆盖: stdio 写读, http 写读, 写入路径 `.cursor/mcp.json`, 多 server 保留, 同名冲突, remove, `${VAR}` 展开, legacy `env` 字段读取
  - kind: unit-test
- [x] 1.2 运行测试确认 1.1 全红 (因 `cursorAdapter` 尚未导出)
  - kind: unit-test
  - 命令: `pnpm test -- src/adapters/__tests__/adapters.test.ts`
  - 观察结果: 8 个新增用例全部 fail (import 解析失败, 符合预期 RED)

## 2. Implementation (GREEN)

- [x] 2.1 在 `src/types.ts` 的 `AgentId` 联合类型中添加 `"cursor"`, 按字母序插入 `codex` 之后
  - kind: unit-test
- [x] 2.2 创建 `src/adapters/cursor.ts`, 实现 `cursorAdapter`:
  - kind: unit-test
  - id: `"cursor"`, name: `"Cursor"`, isGlobal: false
  - configPath: `<projectDir>/.cursor/mcp.json`
  - read/write/remove/has 操作 `mcpServers` 字段, 复用 `readJsonFile` / `writeJsonFile`
  - toAgentFormat 走 wrapper 策略 (与 Gemini CLI 一致): stdio 有 env 时 `{ command: "env", args: [KEY=val, cmd, ...] }`, 无 env 时 `{ command, args }`; HTTP 时 `{ url, headers }`
  - fromAgentFormat: 优先 legacy `env` 字段, 其次 `command === "env"` wrapper, 最后透传; HTTP 路径解析 `url` + `headers`
- [x] 2.3 在 `src/adapters/index.ts` 中导入 `cursorAdapter` 并注册到 `allAdapters` (codex 之后, gemini-cli 之前)
  - kind: unit-test
- [x] 2.4 运行测试确认 1.1 全绿且既有用例不回归
  - kind: unit-test
  - 命令: `pnpm test`
  - 观察结果: `Test Files 20 passed (20) | Tests 144 passed (144)` (原 136 + 8 新增)
- [x] 2.5 运行类型检查
  - kind: build-check
  - 命令: `pnpm exec tsc --noEmit`
  - 观察结果: 无输出 (类型干净)

## 3. Spec & Docs

- [x] 3.1 在 delta `specs/agent-adapters/spec.md` 写入 ADDED `Cursor Adapter` requirement (含读取/写入/同名冲突 3 个 scenario) 与 MODIFIED `Agent 自动检测` requirement (在 detect 列表加入 `.cursor/mcp.json`)
  - kind: manual-verify
- [x] 3.2 更新 `README.md` 与 `docs/README_zh-CN.md`:
  - kind: manual-verify
  - Solution 图加入 Cursor 一行
  - Features 列表加入 Cursor
  - Supported Agents 表加入 `Cursor | .cursor/mcp.json (project) | JSON`
- [x] 3.3 运行 `openspec change validate add-cursor-adapter --strict` 确保 delta 合法
  - kind: build-check
  - 命令: `openspec change validate add-cursor-adapter --strict`

## 4. Runtime verification

- [x] 4.1 在临时目录跑 `mcpsmgr add` 部署一个带 env 的 stdio server, 选择 Cursor agent, `cat .cursor/mcp.json` 确认输出形如 `{ "mcpServers": { "<name>": { "command": "env", "args": [...] } } }`
  - kind: manual-verify
- [x] 4.2 在临时目录写一份 `.cursor/mcp.json`, 跑 `mcpsmgr list --deployed` 确认 Cursor 列被识别
  - kind: manual-verify

## Commit

- **Commit SHA:** _(待提交后回填)_
