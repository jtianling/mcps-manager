# Tasks: fix-codex-http-headers

## 1. Codex HTTP header field regression

- [x] 1.1 Implement Codex HTTP `http_headers` serialization/deserialization with regression coverage
  - kind: unit-test
  - **Spec scenario(s):**
    - `agent-adapters/spec.md` → Scenario: `读取已有配置`
    - `agent-adapters/spec.md` → Scenario: `写入新服务 (http)`
    - `agent-adapters/spec.md` → Scenario: `HTTP round-trip`
    - `agent-adapters/spec.md` → Scenario: `写入新服务 (stdio)` via full-suite regression
    - `agent-adapters/spec.md` → Scenario: `同名冲突` via full-suite regression
  - **Files:**
    - Update: `src/adapters/__tests__/adapters.test.ts`
    - Update: `src/adapters/codex.ts`
  - [x] **RED:** Add failing tests in `src/adapters/__tests__/adapters.test.ts`
    - Behavior under test:
      - `codexAdapter.toAgentFormat` for HTTP returns `{ url, http_headers }` and does not expose a top-level `headers` key
      - `codexAdapter.fromAgentFormat` for HTTP reads `{ url, http_headers }` into `{ transport: "http", url, headers }`
      - HTTP `DefaultConfig` round-trips through `toAgentFormat` and `fromAgentFormat` without semantic loss
      - `codexAdapter.write(...)` serializes HTTP headers into `.codex/config.toml` as `http_headers`, not a `[mcp_servers.<name>.headers]` table
    - Expected failure reason: current Codex adapter still writes and reads `headers` for HTTP
  - [x] **Verify RED:** Run the targeted test file and confirm the new HTTP assertions fail for the expected reason
    - Command: `pnpm vitest run src/adapters/__tests__/adapters.test.ts`
    - **Observed output (fill during apply):**
      ```
      ❯ src/adapters/__tests__/adapters.test.ts (23 tests | 4 failed)
        × converts HTTP config to Codex StreamableHttp format
        × converts HTTP config from Codex StreamableHttp format
        × round-trips HTTP config through Codex agent format
        × writes HTTP config using http_headers in TOML
      AssertionError: expected { Object (url, headers) } to deeply equal { Object (url, http_headers) }
      AssertionError: expected { transport: 'http', …(2) } to deeply equal { transport: 'http', …(2) }
      AssertionError: expected '[mcp_servers.my-mcp]\nurl = "https://…' to contain 'http_headers'
      Test Files  1 failed (1)
      ```
  - [x] **GREEN:** Update `src/adapters/codex.ts` so the HTTP path uses `http_headers` for outbound TOML shape and inbound parsing
  - [x] **Verify GREEN:** Run the targeted test file and the full suite, confirm both pass
    - Command: `pnpm vitest run src/adapters/__tests__/adapters.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      ✓ src/adapters/__tests__/adapters.test.ts (23 tests)
      Test Files  1 passed (1)
      Tests  23 passed (23)

      > mcpsmgr@0.3.0 test /Users/jtianling/workspace/mcps-manager
      > vitest run
      Test Files  19 passed (19)
      Tests  125 passed (125)
      ```
  - [x] **REFACTOR:** Keep the Codex adapter change minimal and avoid altering `DefaultConfig` or non-Codex adapters
  - [x] **Verify REFACTOR:** Re-run the full suite and confirm it stays green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      > mcpsmgr@0.3.0 test /Users/jtianling/workspace/mcps-manager
      > vitest run
      Test Files  19 passed (19)
      Tests  125 passed (125)
      Duration  320ms
      ```
  - [x] **Commit:** `fix(codex): write http headers as http_headers`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `fdb6d7d`

## 2. Delta spec alignment

- [x] 2.1 Confirm the delta spec preserves the base Codex requirement structure except for the intended HTTP additions
  - kind: skip-doc-only
  - **Spec scenario(s):**
    - `agent-adapters/spec.md` → Scenario: `读取已有配置`
    - `agent-adapters/spec.md` → Scenario: `写入新服务 (stdio)`
    - `agent-adapters/spec.md` → Scenario: `写入新服务 (http)`
    - `agent-adapters/spec.md` → Scenario: `HTTP round-trip`
    - `agent-adapters/spec.md` → Scenario: `同名冲突`
  - **Files:**
    - Review: `openspec/changes/fix-codex-http-headers/specs/agent-adapters/spec.md`
    - Review: `openspec/specs/agent-adapters/spec.md`
  - [x] **SKIP:** `skip-doc-only` — this task only checks the wording/structure of spec text and does not change runtime behavior

## 3. OpenSpec validation

- [x] 3.1 Validate the change delta with strict OpenSpec syntax checks
  - kind: build-check
  - **Spec scenario(s):**
    - `agent-adapters/spec.md` → Scenario: `读取已有配置`
    - `agent-adapters/spec.md` → Scenario: `写入新服务 (stdio)`
    - `agent-adapters/spec.md` → Scenario: `写入新服务 (http)`
    - `agent-adapters/spec.md` → Scenario: `HTTP round-trip`
    - `agent-adapters/spec.md` → Scenario: `同名冲突`
  - **Files:**
    - Check: `openspec/changes/fix-codex-http-headers/specs/agent-adapters/spec.md`
  - [x] **BUILD-CHECK:** Run `openspec validate fix-codex-http-headers --strict` and require exit 0
    - **Evidence (fill during apply):**
      ```
      Change 'fix-codex-http-headers' is valid
      ```
  - [x] **Commit:** `chore(openspec): validate fix-codex-http-headers change`
    - **Commit SHA (fill during apply):** `fdb6d7d`

## 4. Runtime verification

- [x] 4.1 Deploy `agent-teams-mcp` into a temporary Codex project and capture the generated TOML evidence
  - kind: manual-verify
  - verify: 在 `/tmp/mcpsmgr-codex-http-fix` 生成 `.codex/config.toml`，确认 `[mcp_servers.agent-teams-mcp]` 下存在 `http_headers`（inline table 或子表均可），且不存在 `[mcp_servers.agent-teams-mcp.headers]`
  - **Spec scenario(s):**
    - `agent-adapters/spec.md` → Scenario: `写入新服务 (http)`
  - **Files:**
    - Read: `~/.mcps-manager/servers/agent-teams-mcp.json`
    - Inspect: `/tmp/mcpsmgr-codex-http-fix/.codex/config.toml`
  - [x] **MANUAL-VERIFY:** [ok] generated TOML contains `http_headers` and does not contain a `headers` table
    - **Evidence (fill during apply):**
      ```
      [mcp_servers.agent-teams-mcp]
      url = "http://127.0.0.1:9099/mcp"

      [mcp_servers.agent-teams-mcp.http_headers]
      Authorization = "Bearer <REPLACE_WITH_DAEMON_TOKEN>"
      ```
  - [x] **Commit:** `chore(verify): capture codex http_headers runtime evidence`
    - **Commit SHA (fill during apply):** `fdb6d7d`

## Scenario Coverage Matrix

| Scenario | Covered by |
| --- | --- |
| `读取已有配置` | `1.1`, `2.1`, `3.1` |
| `写入新服务 (stdio)` | `1.1` (full-suite regression), `2.1`, `3.1` |
| `写入新服务 (http)` | `1.1`, `2.1`, `3.1`, `4.1` |
| `HTTP round-trip` | `1.1`, `2.1`, `3.1` |
| `同名冲突` | `1.1` (full-suite regression), `2.1`, `3.1` |
