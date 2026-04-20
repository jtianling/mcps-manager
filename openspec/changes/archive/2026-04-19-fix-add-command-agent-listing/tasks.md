## 1. Implementation (GREEN)

- [x] 1.1 修改 `src/commands/add.ts`: import 改为 `{ allAdapters, detectAgents }` + `CHECKBOX_DEFAULTS`
  - kind: build-check
- [x] 1.2 构造 `detectedIds = new Set(detectAgents(projectDir).map(a => a.id))`, checkbox choices 改走 `allAdapters.map(...)`, name 模板为 `${adapter.name}${detectedIds.has(adapter.id) ? " (detected)" : ""}${adapter.isGlobal ? " [global]" : ""}`, `checked: detectedIds.has(adapter.id) && !adapter.isGlobal`
  - kind: build-check
- [x] 1.3 删除 `detected.length === 0` 提前返回分支 (`allAdapters` 永远非空)
  - kind: build-check
- [x] 1.4 追加 `...CHECKBOX_DEFAULTS` 保持 vim 键导航与其它命令一致
  - kind: build-check

## 2. Build check

- [x] 2.1 `npx tsc --noEmit` 通过
  - kind: build-check
  - 命令: `cd /Users/jtianling/workspace/mcps-manager && npx tsc --noEmit 2>&1 | grep -v '^npm warn' || true`
  - 观察结果:
    ```text
    (exit 0, 无 error 输出)
    ```
- [x] 2.2 `openspec validate fix-add-command-agent-listing --strict` 通过
  - kind: build-check
  - 命令: `cd /Users/jtianling/workspace/mcps-manager && openspec validate fix-add-command-agent-listing --strict`
  - 观察结果:
    ```text
    Change 'fix-add-command-agent-listing' is valid
    ```

## 3. Runtime verification (manual-verify)

- [x] 3.1 在只有 Antigravity 全局 adapter 配置 (`~/.gemini/antigravity/mcp_config.json`) 的本机环境, 于一个空临时项目目录运行 `mcpsmgr add ts-agent-teams`, 观察勾选列表
  - kind: manual-verify
  - 命令:
    ```bash
    mkdir -p /tmp/mcpsmgr-add-list-test && cd /tmp/mcpsmgr-add-list-test
    # 清理可能残留的本地 agent 配置
    rm -rf .mcp.json .codex .gemini opencode.json
    # 通过 script + timeout 捕获交互式输出, echo -e '\x03' 在 1 秒后发送中断
    cd /tmp/mcpsmgr-add-list-test && \
      script -q /tmp/out.txt bash -c \
        "echo -e '\x03' | timeout 2 node /Users/jtianling/workspace/mcps-manager/dist/index.js add ts-agent-teams"
    ```
  - 预期: 列表里应出现完整的 6 个 adapter (Claude Code / Codex / Gemini CLI / OpenCode / Antigravity / OpenClaw), 其中全局 adapter 标 `[global]`, 已检测的标 `(detected)`, 默认勾选 `(detected)` 且非全局的条目 (本机条件下此集合为空)
  - 观察结果 (ANSI 已过滤):
    ```text
    ? Select agents to add "ts-agent-teams" to:
    ❯◯ Claude Code
     ◯ Codex
     ◯ Gemini CLI
     ◯ OpenCode
     ◯ Antigravity (detected) [global]
     ◯ OpenClaw [global]

    ↑↓ navigate • space select • a all • i invert • ⏎ submit
    ```
  - 判断: 所有 6 个 adapter 均出现 ✓. Antigravity 标了 `(detected)` 因为其全局配置路径 `~/.gemini/antigravity/mcp_config.json` 存在; OpenClaw 未标 `(detected)` 因为 `~/.openclaw/openclaw.json` 不存在; 4 个项目级 adapter (Claude Code / Codex / Gemini CLI / OpenCode) 在空目录里自然不被检测. 全部条目默认未勾选 (唯一可能默认勾选的条件是 "detected 且非全局", 本机不满足). 相比修复前 (只列 Antigravity), 其它 5 个 adapter 现已可选 ✓. 修复后列表行为与 `deploy` 一致 ✓

- [x] 3.2 build 并在工作区 `dist/` 层验证产物加载正常
  - kind: build-check
  - 命令: `cd /Users/jtianling/workspace/mcps-manager && npm run build 2>&1 | tail -5`
  - 观察结果:
    ```text
    > tsc -p .
    (exit 0)
    ```

## 4. Spec sync

- [x] 4.1 人工核对 delta spec `openspec/changes/fix-add-command-agent-listing/specs/project-operations/spec.md` 与主 spec 结构对齐, `Requirement: 项目添加服务` 以 MODIFIED 形式给出, 三条保留 scenario (服务不存在 / 同名冲突 / Ctrl-C 的 scenario 保留在主 spec 的其他 requirement 中), 新增 "项目中无任何 agent 配置文件" scenario
  - kind: manual-verify
  - 观察结果: delta 结构通过 openspec validate --strict; 原 "添加到已检测的 agent" scenario 被 "列出所有已知 agent 供选择" 替换, 其他 scenario 原地保留

## Commit

- **Commit SHA:** (尚未 commit, spec 合入后再与代码一起 commit)

## Scenario Coverage Matrix

| Scenario | Covered by |
| --- | --- |
| `列出所有已知 agent 供选择` | 3.1 (runtime 观察列表有全 6 个 adapter) |
| `服务不存在于中央仓库` | 主 spec 原样保留, 未改动, 由既有 `serverExists` 检查保证 |
| `部分 agent 同名冲突` | 主 spec 原样保留, 未改动, 由 `agent.write` 的 throw 行为保证 |
| `项目中无任何 agent 配置文件` | 3.1 (test dir 只有全局配置, 本地目录无 agent 文件, 验证列表仍完整) |
