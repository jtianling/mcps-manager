## Why

`mcpsmgr add <github-source>` 在 manifest 路径下, 对每一个已存在的中央条目都弹一次 `Server "<name>" already exists in central repository. Overwrite?` confirm. 多 server 仓库 (例: `cross-agent-teams-mcp` 含 `cross-agent-teams` + `cross-agent-teams-channel`) 重复运行 `add` 时, 用户连续回答 N 次同样的问题, 在 CI / 脚本场景里完全跑不了.

参考 skillsmgr CLI 的成熟分层 (`-y` 聚合 / `--force` 窄义), 给 `add` 加 unattended 开关, 既覆盖批量场景, 又不会跟"覆盖单一 server"的窄义路径混淆.

## What Changes

- **新增 `-y` flag (无长形)**: 聚合 unattended 开关.
  - 内部 imply `--force` (跳过覆盖确认).
  - 当 `--agent` 未指定时, 自动选 detected agents (manifest 流走 declared ∩ detected).
  - manifest 流下没匹配的 detected agent 时, SHALL 报错提示加 `--agent`.
  - 必需 `variables` / `envVars` 在 `-y` 下 SHALL 报错而非用默认值或 prompt (防 silent default).
  - optional `envVars` 在 `-y` 下 SHALL NOT 弹 prompt (直接跳过).
- **新增 `-f, --force` flag (窄义)**: 仅跳过覆盖确认, 不影响 agent 选择和变量收集.
- **保持兼容**: 不传 `-y` / `-f` 时行为完全不变; `--agent` 与 `--port` 现有语义保留.
- **不引入 env var**: 不实现 `MCPSMGR_YES=1` 之类, CI 显式写 `-y` 即可.
- **不做 TTY 自动 imply**: 非 TTY 下也要用户显式 `-y`, 防止管道里悄悄做破坏性操作 (留待出问题时再加 fail-fast).

## Capabilities

### Modified Capabilities
- `project-operations`: `add` 命令新增 `-y` / `--force` flag 与对应不交互行为规范.

## Impact

- 修改代码: `src/commands/add.ts` (AddOptions 加 yes/force; force 跳过 confirmOverwrite; yes 在 central/bundle/manifest 三个流里自动选 agent 与 fail-fast 行为), `src/index.ts` (commander 注册两个 flag)
- 新增测试: `src/commands/__tests__/add.test.ts` 6 个用例 (覆盖 -y skip confirm, -f narrow skip, -y auto-select 命中/未命中, -y 必需 var/env fail-fast, -y 跳 optional env)
- 文档: `README.md` 表格新增 -a / -y / -f 三行
- 不涉及: 网络协议, 外部依赖, 中央存储格式, 其它命令.
- 风险: 若 `-y` 行为变更, 已有 CI 脚本可能预期被改动 — 当前无任何 CI 在用, 风险为 0.
