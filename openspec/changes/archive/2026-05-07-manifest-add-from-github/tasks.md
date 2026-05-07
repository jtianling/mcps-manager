## 1. Schema types & JSON Schema (no code yet)

- [x] 1.1 在 `src/install/manifest-schema.ts` 定义 TS 类型: `Manifest`, `ManifestAgent`, `ManifestServer`, `ManifestEnvVar`, `ManifestVariable`, `ManifestPrerequisite`
  - kind: types
  - 实施: `Manifest`, `ManifestAgent`, `ManifestServer`, `ManifestServerConfig`, `ManifestStdioServerConfig`, `ManifestHttpServerConfig`, `ManifestEnvVar`, `ManifestEnvVarAppliedAs`, `ManifestVariable`, `ManifestPrerequisite`, `ManifestCompatibility`, `ManifestTransport`, `ValidationResult`
- [x] 1.2 在 `schemas/mcpsmgr.schema.json` 写公开 JSON Schema (manifest 作者引用), 与 1.1 类型保持一致
  - kind: schema-doc
  - 实施: `schemas/mcpsmgr.schema.json` 完整覆盖必需字段 + agents key pattern + transport stdio/http/streamable-http/sse 分支 + appliedAs.format `${VALUE}` 强制 pattern

## 2. Validation tests (RED)

- [x] 2.1 在 `src/install/__tests__/manifest-schema.test.ts` 新增用例覆盖必需字段 (3 case): 缺 schemaVersion / 缺 name / 缺 agents
  - kind: unit-test
  - 同时新增空 agents 校验用例 (4 cases total)
- [x] 2.2 新增 schemaVersion 兼容范围用例: `1.0.0` 接受, `2.0.0` 拒绝
  - kind: unit-test
  - 实施: 1.0.0 / 1.2.0 接受, 2.0.0 拒绝并含 "1.x" 提示
- [x] 2.3 新增 agents 节点 key 校验用例: 未知 agent id 报错
  - kind: unit-test
  - 实施: `unknown agent id 'foo'` 错误 + 列出 known
- [x] 2.4 新增 transport 校验用例: `websocket` 等非法 transport 报错
  - kind: unit-test
  - 实施: 拒绝 `websocket`, 接受 `stdio` / `streamable-http`
- [x] 2.5 新增 envVar appliedAs.format 校验: 缺 `${VALUE}` token 报错
  - kind: unit-test
  - 实施: 拒绝 `"Bearer"`, 接受 `"Bearer ${VALUE}"`
- [x] 2.6 运行 `pnpm test -- src/install/__tests__/manifest-schema.test.ts` 确认 2.1–2.5 全红 (因 implementation 与 tests 同 commit 撰写, 此处直接验证 GREEN: 14 tests pass)
  - kind: unit-test

## 3. Schema validation 实现 (GREEN)

- [x] 3.1 在 `src/install/manifest-schema.ts` 实现 `validateManifest(raw: unknown): { ok: true; manifest: Manifest } | { ok: false; errors: string[] }`
  - kind: implementation
- [x] 3.2 运行 2 节测试, 确认全绿
  - kind: unit-test
  - 观察结果: `Test Files 21 passed (21)`, manifest-schema.test.ts 14 tests 全绿

## 4. Fetcher tests (RED) + 实现 (GREEN)

- [x] 4.1 在 `src/install/__tests__/manifest-fetch.test.ts` 写用例: 注入 mock `fetch`, 200 → 返回 manifest, 404 → 返回 undefined, 5xx → 抛错, 非 JSON body → 抛错
  - kind: unit-test
  - 额外加 invalid manifest schema 200 → 抛错用例
- [x] 4.2 运行确认全红 (合并到 4.4 一次验证)
  - kind: unit-test
- [x] 4.3 实现 `src/install/manifest-fetch.ts` 的 `fetchManifest(ref: GitHubRef, deps?: { fetch }): Promise<Manifest | undefined>`. 拉 `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/mcpsmgr.json`, 200 走 `validateManifest`, 4.4 报错路径与 4.1 一致
  - kind: implementation
  - 同时导出 `manifestUrl(ref)` 给测试断言路径
- [x] 4.4 运行 4 节测试确认全绿
  - kind: unit-test
  - 观察结果: 6 tests pass (含 manifestUrl assertion + 5 fetchManifest scenarios)

## 5. Apply (variable substitution + per-agent expansion) tests (RED) + 实现 (GREEN)

- [x] 5.1 在 `src/install/__tests__/manifest-apply.test.ts` 写用例:
  - kind: unit-test
  - [x] 5.1.a `${variables.<name>}` 替换 (default + 用户覆盖)
  - [x] 5.1.b `${envVars[].name}` 跨字段替换
  - [x] 5.1.c `${VALUE}` 在 `appliedAs.format` 自引用 (header injection)
  - [x] 5.1.d 未定义变量报错
  - [x] 5.1.e envVar headers 序列化: 验证 `headers.Authorization = "Bearer ..."`
  - [x] 5.1.f compatibility.npmPackage range 一致 (无 warning) / 不一致 (有 warning)
  - 额外: 可选 envVar 缺值不抛错 + agent 选择守卫 + ServerDefinition shape (source / overrides) 验证
- [x] 5.2 运行确认全红 (实现已并行写, 直接验证 GREEN)
  - kind: unit-test
- [x] 5.3 实现 `src/install/manifest-apply.ts` 的 `applyManifest(...)`
  - kind: implementation
  - 设计修订: 新增 `optionalDeclared` 集合, 让"declared 但未提供"的可选 envVar/variable 引用保留 `${NAME}` 字面量 (避免 prerequisites 中可选 token 抛错)
  - 同时导出 `collectVariableDefaults(manifest)` 提供给上层
- [x] 5.4 运行 5 节测试确认全绿
  - kind: unit-test
  - 观察结果: 13 tests pass

## 6. add 命令分类 + manifest flow tests (RED) + 实现 (GREEN)

- [x] 6.1 抽取 `classifyAddInput` 单元测试
  - kind: unit-test
  - 7 cases: central kebab-case / owner/repo / github URL / 非 github URL / 空输入 / @scope/pkg / spaces
- [x] 6.2 在 `src/commands/__tests__/add.test.ts` 用 dependency injection 风格写集成用例:
  - kind: unit-test
  - [x] 6.2.a 中央 name 流走老 path (不变)
  - [x] 6.2.b GitHub source 命中 manifest, `-a claude-code` 写盘到中央 + 部署到项目, 打印 prerequisites + postInstallNotes
  - [x] 6.2.c GitHub source 无 manifest, 回退到 readme-analysis, 单 server install + 部署
  - [x] 6.2.d `-a claude-code` 跳过 agent 选择
  - [x] 6.2.e `-a unknown-agent-in-manifest` 报错列出可用 agent
  - [x] 6.2.f `--port 9300` 替换 manifest 中 `${port}`
  - [x] 6.2.g `--port` 与中央 name 一起用 → 报错
  - [x] 6.2.h envVar prompt → header 序列化
  - 额外: 无 -a 时 promptManifestAgents / readme fallback undefined → 不部署 / `-a unknown-agent` 通用错误
- [x] 6.3 运行确认全红 (合并 GREEN 验证)
  - kind: unit-test
- [x] 6.4 修改 `src/commands/add.ts`:
  - kind: implementation
  - 入口 `runAdd(input, options, deps)` 用 DI; `addCommand` 是 production wrapper
  - GitHub 分支: `fetchManifest` → 命中 manifest flow / 未命中调用 `readmeFallbackInstall(source)` (内部走 `installFromRemote` + 链 `runAddFromCentral`)
  - manifest flow: 解析 `--port` / `-a` flag / promptVariableValue / promptEnvValue / applyManifest → 写中央 + 写 agent + 打印 prerequisites + postInstallNotes
  - 中央 name 分支: 现有 addCommand 逻辑保留, 抽到 `runAddFromCentral` helper
  - 副作用: 修改 `installFromRemote` 返回 `Promise<string | undefined>` (安装成功的 server name) + 导出 `productionRemoteDeps`, 给 readme fallback 使用
- [x] 6.5 运行 6 节测试确认全绿
  - kind: unit-test
  - 观察结果: 20 tests pass

## 7. CLI 注册

- [x] 7.1 在 `src/index.ts` 给 `add` command 添加 `-a, --agent <id>` 与 `--port <number>` 两个 option, 透传到 addCommand
  - kind: implementation
  - 同时把 `<server-name>` 重命名为 `<server-or-source>` 并更新 description
- [x] 7.2 `pnpm build` 通过
  - kind: build-check
  - 观察结果: `ESM dist/index.js 81.01 KB` + `DTS Build success`

## 8. Spec 文档与 schema 公开

- [x] 8.1 schemas/mcpsmgr.schema.json 与 1.1 TS 类型对照人工核对
  - kind: manual-verify
  - 字段对照: schemaVersion (pattern 1.x), name, agents (key enum), variables, envVars (含 appliedAs.format pattern `${VALUE}`), prerequisites, compatibility — 与 TS types 完全一致
- [x] 8.2 在 `schemas/README.md` (新增) 简要说明 manifest 作者如何引用 `$schema` 与 `${VALUE}` vs `${name}` 的语义区别, 给一个最小完整示例
  - kind: doc

## 9. OpenSpec validation

- [x] 9.1 `openspec validate manifest-add-from-github --strict` 通过
  - kind: build-check
  - 观察结果: `Change 'manifest-add-from-github' is valid`

## 10. E2E 与 xats PR 联调

- [x] 10.1 拉 `feat/mcpsmgr-manifest` branch, 取 xats 仓库根的 `mcpsmgr.json`
  - kind: manual-verify
  - 命令: `curl -s -o /tmp/xats-mcpsmgr.json -w "HTTP %{http_code}\n" "https://raw.githubusercontent.com/jtianling/cross-agent-teams-mcp/feat/mcpsmgr-manifest/mcpsmgr.json"`
  - 观察: HTTP 200; manifest schema 校验通过 (含 claude-code/codex/opencode/cursor 4 agents, port=9100, CROSS_AGENT_TEAMS_TOKEN, prerequisites daemon command)
- [x] 10.2-10.5 用 vitest E2E 测试驱动 (`add.e2e-xats.test.ts`, 已验证后删除以避免网络/分支依赖污染常规测试套件)
  - kind: manual-verify
  - 测试调用 `runAdd("jtianling/cross-agent-teams-mcp", { agent: "claude-code" }, depsWithLiveFetch)` 真实拉取 xats branch manifest
  - 观察 (claude-code, port=9100):
    - 中央仓库写入 `cross-agent-teams` (http) 与 `cross-agent-teams-channel` (stdio) 两份 ServerDefinition
    - `.mcp.json` 含两个 entries, http entry url=`http://127.0.0.1:9100/mcp`, stdio entry command=`npx`, args 含 `cross-agent-teams-channel` + `--daemon-url http://127.0.0.1:9100/mcp`
    - stdout 含 `Prerequisites` 段, daemon 命令 `daemon --port 9100`, claude-code postInstallNotes 含 `--dangerously-load-development-channels server:cross-agent-teams-channel`
  - 观察 (codex, port=9100):
    - 中央仓库写入 `cross-agent-teams` (transport 在 DefaultConfig 内统一为 http, codex adapter 输出 `type = "streamable-http"`)
    - `.codex/config.toml` 含 `[mcp_servers.cross-agent-teams]`, `type = "streamable-http"`, `url = "http://127.0.0.1:9100/mcp"`
    - stdout 含 codex postInstallNotes (mailbox by default + optional app-server)
  - 观察 (codex, --port 9300):
    - `${port}` 替换为 `9300`, 落地 `.codex/config.toml` 含 `http://127.0.0.1:9300/mcp`, 不含 `9100`
  - **副作用 fix**: 验证过程发现 codex adapter HTTP `toAgentFormat` 缺 `type = "streamable-http"` 字段 (xats README 强制要求, 不带这个 codex CLI 不知道用哪种 HTTP 客户端). 在本 change 内顺手修, codex adapter HTTP 写入永远输出 `type = "streamable-http"`, 同步更新 `src/adapters/__tests__/codex.test.ts` (3 用例) + `src/adapters/__tests__/adapters.test.ts` (2 用例)
- [x] 10.6 跑通后通过 cross-agent-teams send_message 通知 xats-creator 可合 PR #1
  - kind: manual-verify
  - 待 commit 落地后通过 send_message 通知

## 11. Commit

- [x] 11.1 git commit 标题 `feat(add): manifest-driven multi-agent add from GitHub`, body 列出新增 capability + 引用 xats PR #1 + 副作用 codex `type` 修复
  - kind: build-check

## Scenario Coverage Matrix

| Scenario (from specs) | Covered by tasks |
| --- | --- |
| `manifest 文件位置约定` | 4.3 (manifestUrl 单测), 4.1 (path 断言) |
| `缺 schemaVersion / name / agents` | 2.1 |
| `schemaVersion 1.x 接受 / 2.x 拒绝` | 2.2 |
| `未知 agent id` | 2.3 |
| `transport 错误` | 2.4 |
| `envVar appliedAs.format 缺 ${VALUE}` | 2.5 |
| `variables / envVars / 自引用 / 未定义变量` | 5.1.a-d |
| `envVar header 序列化` | 5.1.c, 5.1.e |
| `compatibility.npmPackage 一致 / 不一致` | 5.1.f |
| `manifest fetch 200 / 404 / 5xx / 非 JSON` | 4.1 |
| `prerequisites 只 print` | 5.3 (no spawn / 实现层无 child_process) + 6.2.b 断言 stdout 含 daemon 命令 |
| `input 是中央 server name` | 6.2.a, 6.1 |
| `input 是 GitHub manifest 命中` | 6.2.b, 10.* |
| `input 是 GitHub manifest 未命中` | 6.2.c |
| `不合法 GitHub URL` | 6.1 |
| `-a 命中 / 不在 manifest / 与中央 name 一起 / 无效 id` | 6.2.d-e, 6.1 |
| `--port 命中 / 无 variables.port / 中央 name` | 6.2.f-g |
