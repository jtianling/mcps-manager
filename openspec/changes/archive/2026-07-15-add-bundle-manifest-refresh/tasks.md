# Tasks: add-bundle-manifest-refresh

## 1. 刷新检测核心逻辑

- [x] 1.1 在 `src/commands/add.ts` 提取 agent 选择逻辑为独立函数 (flag / -y / 交互勾选), 供 bundle 分支在刷新检测前调用一次, 三条后续路径复用结果
- [x] 1.2 实现 diff 预览函数: 用 `parseGitHubSource(bundle.url)` 反解 ref, fetch manifest 成功后以非交互输入 (manifest 变量默认值 + `--var` + `--port`, envVars 只取 `--var` / `process.env`) 调 `applyManifest`, 与 store 旧定义比较 (成员名集合 + 交集 default 配置深比较, 限选中 agents); 预览抛错 (required 变量缺值) 按有差异处理
- [x] 1.3 在 `runAdd` 的 `kind === "bundle"` 分支接入刷新检测: fetch 失败 / 404 / manifest 无效 / 无差异 → 静默走 `runAddFromBundle`; 有差异 → 覆盖确认 (`-y` 视为同意); 同意 → `runAddFromManifest`, 拒绝 → `runAddFromBundle`
- [x] 1.4 `AddDeps` 新增 `confirmManifestRefresh` 依赖注入与 production 实现 (inquirer confirm, 英文文案)
- [x] 1.5 调整 `checkManifestOnlyFlags` 调用时机: bundle 分支不再入口预拒 `--port` / `--var`, 改为最终落旧定义路径时报原错误

## 2. bundle members 合并

- [x] 2.1 `runAddFromManifest` upsertBundle 前读取既有 bundle members 求并集, 避免部分 agent 覆盖挤掉其他成员

## 3. 测试

- [x] 3.1 bundle 命中 + manifest 有差异 + 同意覆盖: per-agent 筛选生效 (codex 只装 cross-agent-teams), store 定义刷新含 bearerTokenEnvVar
- [x] 3.2 bundle 命中 + 有差异 + 拒绝覆盖: 全部 members 按旧定义写入, store / bundles.json 零写入
- [x] 3.3 bundle 命中 + 无差异: 不提示, 行为与现状一致
- [x] 3.4 bundle 命中 + fetch 抛错 / 404: 静默回退, 无错误输出
- [x] 3.5 `-y` 有差异时不提问直接覆盖
- [x] 3.6 裸 repoName 输入命中 bundle 时同样触发刷新检测
- [x] 3.7 部分 agent 覆盖后 bundle members 为并集 (channel 成员保留)
- [x] 3.8 `--var` / `--port` 在 bundle 分支: 进入 manifest 路径时生效, 落旧定义路径时报原错误
- [x] 3.9 agent 选择只发生一次 (prompt 类 deps 调用计数)

## 4. 验证

- [x] 4.1 `pnpm build && pnpm test` 全绿
- [x] 4.2 手工冒烟: 本地 store 存在旧 xats bundle 时 `node dist/index.js add jtianling/cross-agent-teams-mcp -a codex` 出现覆盖提示, 同意后 codex 配置含 `bearer_token_env_var` 且无 channel server
