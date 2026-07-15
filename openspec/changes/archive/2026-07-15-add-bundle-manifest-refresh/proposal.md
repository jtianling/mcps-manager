# Proposal: add-bundle-manifest-refresh

## Why

`mcpsmgr add <github-source>` 命中已安装 bundle 时, 直接把中央 store 里的陈旧定义写入 agent, 完全跳过源仓库 manifest.  实际案例: xats 的旧 bundle 定义 (2026-05) 缺 `bearerTokenEnvVar`, 且不区分 per-agent server, 把 claude-code 专属的 `cross-agent-teams-channel` 也装给了 Codex, 导致 Codex 启动时 401 (无 token) 和 -32601 (channel 非 codex 可用 server) 两个报错.  源仓库 manifest 早已修正这两点, 但 bundle 路径永远用不上.

## What Changes

- `add` 命令 bundle 命中分支: 先用 bundle.url 解析 GitHub ref 并重新 fetch `mcpsmgr.json`
- fetch 失败 (网络错误 / 404 / manifest 无效) 时静默回退现行为, 保持离线可用
- fetch 成功后做非交互式 applyManifest 预览 (manifest 变量默认值 + `--var` / 环境变量, 不弹任何交互提问), 与 store 旧定义比较 (成员名集合 + default 配置深比较, 限选中 agents 范围)
- 无差异: 直接走现行为, 不打扰用户
- 有差异: 提示 "检测到新版本, 是否覆盖旧定义"; 同意则走完整 manifest 安装流程 (per-agent server 筛选, bearerTokenEnvVar, 正常 env 交互), 拒绝则用旧定义 (现行为)
- 覆盖路径 upsertBundle 时与既有 bundle members 合并, 避免只选部分 agent 时挤掉其他 agent 的 server 成员
- `-y` 非交互场景视为同意覆盖

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `project-operations`: add 命令 bundle 命中路径新增 manifest 刷新检测与覆盖确认流程 (新增 requirement); bundle 覆盖安装时 bundle members 合并语义

## Impact

- `src/commands/add.ts`: `runAdd` bundle 分支 / `runAddFromBundle` / `runAddFromManifest` (bundle members 合并), `AddDeps` 增加确认提示与 (可能的) manifest fetch 依赖注入
- `src/services/source-resolver.ts`: 无接口变化 (bundle.url 已暴露)
- `src/install/manifest-fetch.ts` / `manifest-apply.ts`: 复用, 预期无改动或仅导出辅助
- 测试: `src/commands/__tests__/` add 命令 bundle 路径新增用例
- 不影响 `install` / `update` 命令与 README fallback 路径
