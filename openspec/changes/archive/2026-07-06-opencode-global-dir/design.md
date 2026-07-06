## Context

0.4.8 引入的 `--global` 机制: adapter 可选声明 `globalDir?: () => string`, add 命令用它替换写入目录, `configPath(dir)` 拼出最终文件。codex 已实现 (`~/.codex/config.toml`)。opencode adapter 的 `configPath` 是 `join(dir, "opencode.json")`。

xats 仓库文档曾记录 opencode 全局路径为 `~/.config/opencode/config.json`, 但 jt 本机 (opencode 1.17.13) 实际为 `~/.config/opencode/opencode.json` — 与现有拼法一致, 无需按 global 覆盖文件名的机制。

## Goals / Non-Goals

**Goals:**

- `mcpsmgr add ... -a opencode --global` 写入 `~/.config/opencode/opencode.json`。

**Non-Goals:**

- 不支持 `config.json` 备选文件名 (实测以 `opencode.json` 为准, 需要时再议)。
- 不为 claude-code 提供全局支持 (xats 明确不请求: channel 唤醒依赖项目级配置)。

## Decisions

- opencode adapter 增加 `globalDir: () => join(homedir(), ".config", "opencode")`, 复用既有 `--global` 校验与目录切换逻辑, 零机制新增。

## Risks / Trade-offs

- [部分旧版 opencode 若只认 `config.json`] → 以当前实测 (1.17.13, `opencode.json`) 为准; xats 文档由对方按此修正。
