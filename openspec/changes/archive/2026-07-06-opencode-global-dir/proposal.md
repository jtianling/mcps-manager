## Why

0.4.8 的 `add --global` 仅 codex 支持; xats 侧标准化设备配置流程时, opencode 的全局安装分支只能让用户手工 merge `~/.config/opencode/opencode.json`。已核实 jt 本机 (opencode 1.17.13) 的全局配置文件就是 `~/.config/opencode/opencode.json`, 与 opencode adapter 现有的 `join(dir, "opencode.json")` 拼法天然吻合, 补一个 `globalDir` 即可复用 0.4.8 的 `--global` 机制。

## What Changes

- opencode adapter 声明 `globalDir()` 返回 `~/.config/opencode`, 使 `mcpsmgr add ... -a opencode --global` 写入 `~/.config/opencode/opencode.json`。
- `--global` 的支持集合从「仅 codex」扩为「codex 与 opencode」; 不支持全局的报错行为不变 (换用其他 agent 作为示例)。
- README 与 `--help` 文案同步。

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `agent-adapters`: OpenCode Adapter 增加 `globalDir()` 全局写入位置声明。
- `project-operations`: `add --global` 支持集合扩为 codex 与 opencode。

## Impact

- 受影响代码: `src/adapters/opencode.ts`, `src/index.ts` (help 文案), README, 对应 `__tests__`。
- 行为变化: 仅新增 `--global` 对 opencode 的支持路径; 既有报错路径与项目级行为不变。
