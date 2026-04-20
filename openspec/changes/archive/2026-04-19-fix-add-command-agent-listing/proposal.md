## Why

`mcpsmgr add <server>` 和 `mcpsmgr deploy` 对 agent 列表的处理不一致. `deploy` 走 `allAdapters`, 把所有已知 agent 都列出来并用 `(detected)` 标记配置文件已存在的那些 (见 `src/commands/deploy.ts:37`); `add` 反而走 `detectAgents(projectDir)`, 只列出配置文件已存在的 agent (见 `src/commands/add.ts:35`). 实际影响:

- 在一个只有全局 Antigravity 配置、没有 Claude Code 配置的项目里运行 `mcpsmgr add ts-agent-teams`, 列表里只出现 `Antigravity [global]`, 完全看不到 Claude Code
- 用户期望的工作流是"先 add 再让 adapter.write 去创建配置文件", 但 `add` 的预先筛选把这条路径堵死了
- 现有 `remove` 用 `allAdapters` + `adapter.has()` 检测, 行为更宽容且一致

根因是设计分歧: `add` 的原实现把"未检测到 agent 配置"视为硬错误并提前返回, 但 `adapter.write()` 本就能创建不存在的配置文件, 这个提前返回既无必要也不符合 `deploy` 的行为契约.

## What Changes

- `src/commands/add.ts`: import `allAdapters`, checkbox choices 改走 `allAdapters.map(...)`, 用 `detectAgents` 的结果构造 `detectedIds` 集合并在 choice name 里标记 `(detected)`, 默认勾选"已检测到且非全局"的 agent. 移除 `detected.length === 0` 的提前返回分支, 因为 `allAdapters` 永远非空
- 追加 checkbox UX 统一: 使用 `CHECKBOX_DEFAULTS` 扩展以保持 j/k vim 键导航与 `deploy` / `remove` 一致
- 规范: `project-operations` spec 的 "项目添加服务" requirement 下 "添加到已检测的 agent" scenario MODIFIED, 明确 "列出所有已知 agent, 对检测到的标 `(detected)`, 默认勾选已检测的非全局 agent"

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `project-operations`: "项目添加服务" requirement 下 "添加到已检测的 agent" scenario MODIFIED, 从"检测项目中已存在的 agent 配置文件, 展示列表"改为"列出所有已知 agent, 标记 `(detected)` 并默认选中已检测的非全局 agent, 未检测的 agent 未勾选但仍可选"

## Impact

- 代码: `src/commands/add.ts` (imports + checkbox choices + 去掉早退)
- 规范: `openspec/specs/project-operations/spec.md` (1 个 scenario 的措辞)
- 测试: `src` 下没有 `add` 的单测, 这次作为 UI/交互行为改动走 `kind: manual-verify` (在真实项目目录跑 `mcpsmgr add` 观察列表), 不额外补单测
- 用户影响:
  - 原先在无 agent 配置目录里运行 `add` 会直接返回 "No agent config files detected"; 改动后会正常展示 agent 列表 (全部未勾选, 用户主动勾选)
  - 已有 agent 配置的目录行为基本不变, 只是列表多出未配置的 agent 作为可选项
- 与已落地 fix 的关系: 代码修改已在工作区 (uncommitted). 这次补 spec 的动作让 spec 和代码重新对齐; 如果 spec 先合并代码后合并, 行为与 spec 始终一致
