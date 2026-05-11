## 1. Research

- [x] 1.1 调研 hermes-agent (https://github.com/NousResearch/hermes-agent) 的 MCP 配置形式
  - kind: manual-verify
  - 结论: YAML 配置在 `~/.hermes/config.yaml`, 顶层 `mcp_servers` (snake_case), 无 `type` 字段 (按 command/url 推断), `env` 是 mapping, 仅支持 `${VAR}` 大括号引用, 不存在项目级 scope
  - 引用: `hermes_cli/mcp_config.py:8`, `website/docs/reference/mcp-config-reference.md:38-53`

## 2. Tests (RED)

- [x] 2.1 新增 `src/adapters/__tests__/hermes.test.ts`, 覆盖: stdio 写读 (with/without env), http 写读 (with/without headers), 写入到 `~/.hermes/config.yaml` (通过 `vi.doMock("node:os")` 把 homedir 重定向到 tmpDir), 顶层 `mcp_servers` (snake_case), YAML 输出非 JSON, 多 server 保留, 同名冲突, remove, has, `${VAR}` 展开 (consumed env 移除 / partial 替换保留剩余 env), legacy 读 (str-coerce 非 string env 值), unknown format 返回 undefined, 嵌套目录自动创建, 保留其它顶层字段
  - kind: unit-test
- [x] 2.2 运行测试确认 2.1 全红 (`hermesAdapter` 尚未导出)
  - kind: unit-test
  - 命令: `pnpm exec vitest run src/adapters/__tests__/hermes.test.ts`
  - 观察结果: import 解析失败, 全红 (符合 RED 预期)

## 3. Implementation (GREEN)

- [x] 3.1 添加 `yaml@^2.8.4` 依赖
  - kind: build-check
  - 命令: `pnpm add yaml`
- [x] 3.2 在 `src/types.ts` 的 `AgentId` 联合类型尾部追加 `"hermes-agent"`
  - kind: unit-test
- [x] 3.3 创建 `src/adapters/hermes.ts`:
  - kind: unit-test
  - id: `"hermes-agent"`, name: `"Hermes Agent"`, isGlobal: `true`
  - configPath: `homedir() + /.hermes/config.yaml` (常量, 与 antigravity/openclaw 风格一致)
  - read/write/remove/has 操作顶层 `mcp_servers` 字段
  - `readYamlFile`: 不存在返回 `{}`; 用 `yaml.parse`
  - `writeYamlFile`: 不存在则 `mkdir -p`; 用 `yaml.stringify` (尾随换行由库自带)
  - `toAgentFormat`: stdio 走 native env (复用 `resolveEnvInArgs` 解 `${VAR}`, 剩余 env 进 `env` mapping, 无剩余时省略); http 写 `{ url, headers? }`, headers 为空时省略
  - `fromAgentFormat`: `command` → stdio (env 用 `readEnvField` 把非 string 值 String 化); `url` → http; 都没有返回 undefined
- [x] 3.4 在 `src/adapters/index.ts` 中导入 `hermesAdapter` 并追加到 `allAdapters` 末尾
  - kind: unit-test
- [x] 3.5 在 `src/install/manifest-schema.ts` 的 `KNOWN_AGENT_IDS` 尾部追加 `"hermes-agent"`
  - kind: unit-test
- [x] 3.6 运行测试确认 2.1 全绿且既有用例不回归
  - kind: unit-test
  - 命令: `pnpm test`
  - 观察结果: `Test Files 29 passed (29) | Tests 248 passed (248)` (原 228 + 20 新增)
- [x] 3.7 运行类型检查
  - kind: build-check
  - 命令: `pnpm exec tsc --noEmit`
  - 观察结果: 无输出 (类型干净)
- [x] 3.8 运行打包
  - kind: build-check
  - 命令: `pnpm build`
  - 观察结果: `ESM Build success`, `DTS Build success`

## 4. Spec & Docs

- [x] 4.1 在 delta `specs/agent-adapters/spec.md` 写入 ADDED `Hermes Adapter` requirement (含读取/写入 stdio/写入 http/同名冲突/移除 5 个 scenario)
  - kind: manual-verify
- [x] 4.2 更新 `README.md`:
  - kind: manual-verify
  - Supported Agents 表加入 `Hermes | ~/.hermes/config.yaml | global | YAML`
  - global agents 提示语把 Hermes 加进去
- [x] 4.3 运行 `openspec validate add-hermes-adapter --strict` 确保 delta 合法
  - kind: build-check
  - 命令: `openspec validate add-hermes-adapter --strict`

## Commit

- **Commit SHA:** 47f69693d1d3b4871e9d9aa0e42747075b43883a
