## Why

Some MCP servers (xats / cross-agent-teams-mcp 是一个具体案例) 在不同 agent 上需要不同形态的配置:

- claude-code 需要 **两个** server entries: HTTP entry + stdio channel proxy entry, 还要外部启动 flag (`--dangerously-load-development-channels`)
- codex 需要 streamable-http 一个 entry
- opencode / cursor 需要 http 一个 entry
- 还有 daemon 必须先启动 (`npx ... daemon --port 9100`) 这种全局前置

mcpsmgr 现在的 install + add 两步流程, 加上 README rule-based 解析 (一仓库一个 server) 完全覆盖不了这种 "一个仓库 → 不同 agent 不同 server bundle" 的场景. 用户得手写多份 ServerDefinition + 自己处理 token / port / 启动顺序, 体验劝退.

## What Changes

新增 manifest-driven add flow:

1. 仓库作者在仓库根目录提供 `mcpsmgr.json` manifest, 显式声明每个 agent 需要的 server entries, 全局 prerequisites, 共享 envVars / variables, postInstallNotes
2. `mcpsmgr add <github-source>` 命令扩展: 当输入是 GitHub source (URL 或 `owner/repo`) 时, 先尝试拉 `mcpsmgr.json`:
   - 命中 manifest → 进入多 agent / 多 server 部署流程, 让用户选 agent (或用 `-a/--agent` flag 指定), 完成 prompt env / variables → 把每个目标 server 写入中央仓库 **同时** 部署到当前项目对应 agent
   - 没命中 manifest → 回退到现有 README rule-based 分析 (单 server install + add)
3. `mcpsmgr add <central-server-name>` 现有语义保持: 中央 → 项目, 不变
4. 新增 `manifest-analysis` capability 描述 manifest schema, fetch 策略, 变量/env 替换语义

## Capabilities

### New Capabilities

- `manifest-analysis`: 定义 `mcpsmgr.json` schema (含 `agents`, `prerequisites`, `envVars`, `variables`, `compatibility`, `postInstallNotes`), GitHub raw 拉取策略, 变量替换语义 (`${name}` 跨字段 vs `${VALUE}` envVar 自引用), schema 校验

### Modified Capabilities

- `project-operations`: `mcpsmgr add` 输入分类扩展, 接受 GitHub source 时进入 manifest-driven flow; 新增 `-a/--agent` flag; 无 manifest 时回退到 readme-analysis

## Impact

- 代码:
  - 新增 `src/install/manifest-fetch.ts` (fetch `mcpsmgr.json` from raw GitHub)
  - 新增 `src/install/manifest-schema.ts` (TS types + JSON schema validation)
  - 新增 `src/install/manifest-apply.ts` (variable substitution + per-agent server expansion)
  - 修改 `src/commands/add.ts` (输入分类 + GitHub source 分支 + `-a` flag)
  - 修改 `src/index.ts` CLI 注册 (`-a / --agent` flag)
  - 新增 `schemas/mcpsmgr.schema.json` (公开 JSON Schema, manifest 作者引用)
- 规范: 新增 `manifest-analysis` spec, 修改 `project-operations` 的 `add` requirement
- 测试:
  - `src/install/__tests__/manifest-fetch.test.ts`
  - `src/install/__tests__/manifest-schema.test.ts`
  - `src/install/__tests__/manifest-apply.test.ts`
  - `src/commands/__tests__/add.test.ts` (扩展)
- 依赖: 复用现有 `fetchGitHubReadme` 模式, 不引入新 npm 包. JSON Schema 校验用现有 ajv 或手写 validator (倾向手写, 保持轻量)
- 用户影响:
  - 老 `mcpsmgr add <central-name>` 完全兼容, 无 break
  - 仓库作者要享受这个流程要在仓库根加 `mcpsmgr.json`. xats 仓库已有 PR #1 (`feat/mcpsmgr-manifest`) 作为首个落地案例
  - manifest 中 `prerequisites` 只 print 不 exec (避免 mcpsmgr 替用户起后台进程)
