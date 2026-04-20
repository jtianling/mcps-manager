## 1. Tests (RED)

- [x] 1.1 在 `src/adapters/__tests__/codex.test.ts` 新增 `toAgentFormat stdio - env 原生表` 用例：输入 `{ command: "npx", args: ["@pkg"], env: { FOO: "bar" } }`，断言返回 `{ command: "npx", args: ["@pkg"], env: { FOO: "bar" } }`（不含 `command: "env"` 前缀）
  - kind: unit-test
- [x] 1.2 新增 `toAgentFormat stdio - 空 env` 用例：env 为 `{}` 时返回对象 MUST NOT 包含 `env` 字段
  - kind: unit-test
- [x] 1.3 新增 `toAgentFormat stdio - 混合展开` 用例：args 含 `${API_KEY}` 且 env 含 `API_KEY` + `DEBUG`，`API_KEY` 展开进 args，`DEBUG` 进原生 `env` 表
  - kind: unit-test
- [x] 1.4 新增 `fromAgentFormat stdio - 原生 env` 用例：输入 `{ command: "npx", args: [...], env: { FOO: "bar" } }`，断言返回 `{ transport: "stdio", command: "npx", args: [...], env: { FOO: "bar" } }`
  - kind: unit-test
- [x] 1.5 新增 `fromAgentFormat stdio - 老 wrapper 迁移` 用例：输入 `{ command: "env", args: ["FOO=bar", "npx", "@pkg"] }`（模拟老配置），断言返回 `{ transport: "stdio", command: "npx", args: ["@pkg"], env: { FOO: "bar" } }`
  - kind: unit-test
- [x] 1.6 新增 round-trip 用例：带 env 的 stdio `DefaultConfig` → `toAgentFormat` → `fromAgentFormat` 还原等价 `DefaultConfig`
  - kind: unit-test
- [x] 1.7 新增写盘 smoke 测试：调用 `codexAdapter.write(...)` 写带 env 的 stdio server，读回 TOML 文本断言出现 `env = {` 或 `[mcp_servers.<name>.env]` 子表且未出现 `"env"` 作为 command 值
  - kind: unit-test
- [x] 1.8 运行测试确认 1.1–1.7 全红
  - kind: unit-test
  - 命令：`pnpm test -- src/adapters/__tests__/codex.test.ts`
  - 观察结果：
    ```text
    ❯ src/adapters/__tests__/codex.test.ts (11 tests | 4 failed)
      × toAgentFormat stdio - env uses native table
      × toAgentFormat stdio - expands referenced env and preserves remaining env natively
      × round-trips stdio config with env
      × write smoke test emits native env TOML without env wrapper command
    AssertionError: expected { command: 'env', ... } to deeply equal { command: 'npx', env: {...} }
    ```

## 2. Implementation (GREEN)

- [x] 2.1 修改 `src/adapters/codex.ts` 的 `toAgentFormat` stdio 分支：
  - kind: unit-test
  - 调用 `resolveEnvInArgs(config.args, config.env)` 拿到 `resolvedArgs` + `remainingEnv`（保留现有 `${VAR}` 展开语义）
  - 构造返回对象 `{ command: config.command, args: resolvedArgs }`，若 `remainingEnv` 非空则加 `env: { ...remainingEnv }`，否则不加
- [x] 2.2 修改 `src/adapters/codex.ts` 的 `fromAgentFormat` stdio 分支：
  - kind: unit-test
  - 优先检查 `raw["env"]`（原生）和 `raw["environment"]`（legacy 兼容），若存在则直接使用
  - 仅当 `raw["env"]` 缺失且 `raw["command"] === "env"` 时，才走 `parseEnvArgs` wrapper 路径
  - 其它情形返回 `env: {}`
- [x] 2.3 运行测试确认 1.1–1.7 全绿，既有其它 Codex 用例不回归
  - kind: unit-test
  - 命令：
    - `pnpm test -- src/adapters/__tests__/codex.test.ts`
    - `pnpm test`
  - 观察结果：
    ```text
    ✓ src/adapters/__tests__/codex.test.ts (11 tests)
    Test Files  20 passed (20)
    Tests  136 passed (136)
    ```

## 3. Spec sync

- [x] 3.1 人工核对 `openspec/changes/codex-stdio-native-env/specs/agent-adapters/spec.md`
  - kind: manual-verify 的 MODIFIED 两个 requirement 与 `openspec/specs/agent-adapters/spec.md` 原文结构对齐（"Adapter output format" 完整内容保留，只追加/替换与 native-env 相关的措辞；Codex Adapter 保留原有 scenario，追加 stdio/迁移读取 scenario）
  - 结果：delta spec 结构与主 spec 对齐；主 spec 仍是旧文案，待后续 OpenSpec sync/archive 时回写
- [x] 3.2 运行 `openspec validate codex-stdio-native-env --strict` 确保 delta 语法合法
  - kind: build-check
  - 观察结果：
    ```text
    Change 'codex-stdio-native-env' is valid
    ```

## 4. Runtime verification

- [x] 4.1 在临时目录用本 change 的 adapter 部署一个带 env 的 stdio server
  - kind: manual-verify（可用仓库里 `web-search-prime` 或 `jina-mcp-server` 作样本），`cat .codex/config.toml` 确认输出形如 `command = "npx"` + `env = { ... }`，无 `command = "env"` wrapper
  - 临时目录：`/tmp/mcpsmgr-codex-native-env`
  - 观察结果：
    ```toml
    [mcp_servers.geminimcp]
    command = "uvx"
    args = [ "--from", "git+https://github.com/GuDaStudio/geminimcp.git", "geminimcp" ]

    [mcp_servers.geminimcp.env]
    GOOGLE_API_KEY = "runtime-test-key"
    ```
- [x] 4.2 在临时目录手写一份老 wrapper 格式
  - kind: manual-verify `.codex/config.toml`，跑 `mcpsmgr list --deployed` 或 `mcpsmgr sync`，确认能读回正确的 server 列表（验证迁移读路径）
  - 临时目录：`/tmp/mcpsmgr-codex-legacy`
  - 命令：`node /Users/jtianling/workspace/mcps-manager/dist/index.js list --deployed`
  - 观察结果：
    ```text
    Server                     Codex  Antigravity
    -------------------------  -----  -----------
    figma-dev-mode-mcp-server  -      stdio
    legacy-search              stdio  -
    pencil                     -      stdio
    ```
  - 说明：输出里额外出现了本机现有的 Antigravity 全局配置，但 `legacy-search` 已被 Codex 路径正确识别为 `stdio`
- [x] 4.3 把 4.1 和 4.2 的观察结果粘贴回 tasks.md 作为 evidence
  - kind: manual-verify

## 5. 交叉验证

- [x] 5.1 如果 `fix-codex-http-headers` 已经合并
  - kind: manual-verify
  - 重跑 HTTP 部署确认本 change 没破坏 HTTP 路径；若先合本 change，反之
  - `fix-codex-http-headers` change 已存在
  - Full suite 中 Codex HTTP 回归测试保持通过
  - 额外运行时交叉验证（`/tmp/mcpsmgr-codex-http-crosscheck/.codex/config.toml`）：
    ```toml
    [mcp_servers.web-search-prime]
    url = "https://open.bigmodel.cn/api/mcp/web_search_prime/mcp"

    [mcp_servers.web-search-prime.http_headers]
    Authorization = "Bearer runtime-http-token"
    ```

## Commit

- **Commit SHA:** `8fb3f5d`

## Scenario Coverage Matrix

| Scenario | Covered by |
| --- | --- |
| `Args contain ${VAR} references` | `1.3` (mixed expand test) |
| `Env vars not referenced in args (wrapper-strategy adapter)` | N/A (Codex is native-env, not wrapper-strategy) |
| `Env vars not referenced in args (native-env adapter)` | `1.1` (native env table test) |
| `Mixed - some referenced, some not` | `1.3` (mixed expand test) |
| `Write stdio config without env vars` | `1.2` (empty env test) |
| `Read new format config` | `1.4` (native env read test) |
| `Read native env format config` | `1.4` (native env read test) |
| `Read legacy wrapper from a native-env adapter's file` | `1.5` (old wrapper migration test) |
| `Read legacy format config (backward compatibility)` | `1.5` (old wrapper migration test), `4.2` (runtime) |
| `读取已有配置` | `1.4`, `1.5`, `4.2` |
| `写入新服务 (stdio)` | `1.1`, `1.7`, `4.1` |
| `写入新服务 (http)` | `5.1` (cross-verify, HTTP path unchanged) |
| `迁移老格式读取` | `1.5`, `4.2` |
| `同名冲突` | full-suite regression (adapters.test.ts) |
