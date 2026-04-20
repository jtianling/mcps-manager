## Context

三个项目级命令 `deploy` / `add` / `remove` 都要让用户选 agent, 但它们的 choice 列表构造策略原先分了三派:

| 命令 | 源 | 处理 |
| --- | --- | --- |
| `deploy` | `allAdapters` | 标 `(detected)`, 默认勾选检测到的非全局 agent |
| `add` (旧) | `detectAgents(projectDir)` | 只列检测到的 agent, 无"未检测"选项, 若全无配置则早退 |
| `remove` | `allAdapters` + `adapter.has()` | 只保留实际含该服务的 agent, 不检测配置文件是否存在 |

`remove` 的做法是对的 (它需要的是"哪些 agent 里有这个 server"), 但 `add` 和 `deploy` 的分歧没有语义基础 — 两者都是"把 server 写入 agent 配置", `adapter.write()` 能自行创建缺失的配置文件.

## Goals / Non-Goals

- Goals: 对齐 `add` 和 `deploy` 的 agent 列表行为; 用户在任何项目目录都能向任何 adapter 添加 server
- Non-Goals: 不动 `remove`; 不改 `adapter.write()` 语义; 不新增测试套件

## Decisions

- **Decision 1: 用 `allAdapters` 列全集, 而不是只改 `detectAgents` 的行为**
  - 备选: 改 `detectAgents` 总是返回全集 (违反函数名含义, 会波及 `deploy`)
  - 选中: 在 `add.ts` 自己构造 `detectedIds` set, 把"检测"这件事从"过滤"降为"标记", 和 `deploy` 的做法完全一致
- **Decision 2: 删除 `detected.length === 0` 的早退分支**
  - 原分支提示用户 "Use mcpsmgr deploy first", 但这条建议本身就是错的 — `add` 能胜任首次部署
  - `allAdapters` 编译期常量, 不可能为空, 所以不需要"空列表"的兜底
- **Decision 3: 不新增单元测试**
  - `add` 的核心逻辑是 UI 交互, 现有代码里没有 add 命令的单测, 补一个需要大量 `@inquirer/prompts` mock
  - 行为可以通过 `kind: manual-verify` 在真实项目目录中观察 checkbox 列表验证
  - 底层 `allAdapters` / `detectAgents` / `adapter.write()` 都有既有覆盖

## Risks / Trade-offs

- **Risk**: 用户不熟悉的 agent 也会出现在列表里, 可能误勾选
  - 缓解: 默认不勾选未检测的 agent; 仅在用户主动勾选时才写入
- **Risk**: 列表变长 (从 "已检测 N 个" 变成 "总计 6 个"), 小终端下可能需要滚动
  - 缓解: 和 `deploy` 完全一致, 用户对此已有预期
