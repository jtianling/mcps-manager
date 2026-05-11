## 1. URL 归一化与 bundle 标识工具

- [x] 1.1 新增 `src/utils/url-normalize.ts`, 导出 `normalizeGitUrl(input: string): string | null` 与 `makeBundleId(type: "git", url: string): string`
- [x] 1.2 实现 owner/repo, `https://github.com/o/r[.git][/]`, `git@github.com:o/r.git`, 大小写差异, 非 GitHub host 的全部分支
- [x] 1.3 新增单元测试 `src/__tests__/url-normalize.test.ts` 覆盖每种输入形态 (含负向: 非 GitHub URL 返回 null)

## 2. 类型与路径扩展

- [x] 2.1 修改 `src/types.ts`: `ServerDefinition` 增加 `repoName?: string` 与 `bundleId?: string` 字段
- [x] 2.2 修改 `src/utils/paths.ts`: 新增 `bundlesFile = ~/.mcps-manager/bundles.json` 路径

## 3. Bundle 存储工具

- [x] 3.1 新增 `src/utils/bundle-store.ts`, 实现 `readBundles()`, `readBundle(id)`, `upsertBundle(id, info)`, `removeMember(id, serverName)` API
- [x] 3.2 缺失文件 → 视作空集合; 损坏 JSON → 抛错; 写入时 atomic write + chmod 600 与 `server-store.ts` 一致
- [x] 3.3 单元测试 `src/__tests__/bundle-store.test.ts` 覆盖 CRUD, 最后一个 member 自动 drop, 损坏文件报错

## 4. Source Resolver

- [x] 4.1 新增 `src/services/source-resolver.ts`, 导出 `resolve(input: string): ResolveResult`
- [x] 4.2 实现 shape 检测 (`url` / `owner-repo` / `kebab` / `invalid`); 对 URL/owner-repo 走 normalize + bundleId 查; 对 kebab 走 serverName → repoName 反查链
- [x] 4.3 多 bundle 同 repoName 返回 `not-found` with `inputForm: "ambiguous-reponame"` 并带候选 list
- [x] 4.4 单元测试 `src/__tests__/source-resolver.test.ts` 覆盖每条分支 (含 server 优先于 repoName, ambiguous, not-found 各种 inputForm)

## 5. install / manifest-apply 写入 source 元数据

- [x] 5.1 修改 `src/install/manifest-apply.ts`: `applyManifest` 输出的每个 `ServerDefinition` 携带 `repoName` 与 `bundleId` (基于传入的 `source` 字符串归一化得到)
- [x] 5.2 修改 `src/commands/install.ts`: README fallback 单 server 写入时也补 `repoName` / `bundleId` (前提是 source 是 GitHub 形态)
- [x] 5.3 在 GitHub install 完成所有 server 写入后, 调用 `upsertBundle(bundleId, { url, members, selectionMode: "all" })`
- [x] 5.4 本地路径 install 与字符串 `"local"` 来源跳过 repoName/bundleId 与 bundle 写入

## 6. add 命令 resolver-first 重构

- [x] 6.1 修改 `src/commands/add.ts`: 入口先调 `resolve(serverInput)`, 命中 `server` 或 `bundle` 直接走 `runAddFromCentral` (或新建 `runAddFromBundle`) 写选定 agent, 不拉 manifest, 不询问覆盖
- [x] 6.2 `resolve` 返回 `not-found` 且 `inputForm` 为 `url` / `owner-repo` 时, fallback 到现有 `runAddFromGitHub` 路径
- [x] 6.3 `not-found` 且 `inputForm` 为 `kebab` 时, 报现有 "Server ... not found in central repository" 错误; `ambiguous-reponame` 报新错误并列出候选
- [x] 6.4 删除现有 `classifyAddInput` 中与 resolver 重复的输入分类逻辑 (或保留为内部 helper 但不再直接驱动分发)

## 7. uninstall 同步维护 bundle

- [x] 7.1 修改 `src/commands/uninstall.ts` (或对应 server-management 实现文件): 删除 server 文件之前读 ServerDefinition, 拿到 `bundleId` 若存在则调 `removeMember(bundleId, name)`
- [x] 7.2 删完 member 后 bundle 空了, `removeMember` 自身负责删 bundle 条目 (任务 3.3 覆盖)
- [x] 7.3 单元测试更新: uninstall 单 member, uninstall 多 member 之一, uninstall 无 bundleId 的旧 server

## 8. add 命令测试更新

- [x] 8.1 更新 `src/commands/__tests__/add.test.ts`: 覆盖 resolver 命中 server / 命中 bundle / not-found fallback / not-found kebab error / ambiguous 报错每条分支
- [x] 8.2 模拟"首次 `add jtianling/cross-agent-teams-mcp`" + "之后 `add cross-agent-teams-mcp`"两步流程, 断言两步后 agent 配置完全相同, 第二步不发生网络请求 / 不写中央 / 不弹覆盖提示
- [x] 8.3 旧 ServerDefinition (无 repoName/bundleId) 走 `add <server-name>` 仍正常工作

## 9. 文档与端到端验证

- [x] 9.1 更新 `README.md` 与 `docs/` 中关于 `add` / `install` / `uninstall` 行为的描述, 说明三种输入形态与 bundle 反查
- [x] 9.2 运行 `pnpm test` / `pnpm typecheck` / `pnpm build` 全绿
- [x] 9.3 手动 E2E: 在干净 `~/.mcps-manager` 上跑 `npx mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code`, 再跑 `npx mcpsmgr add cross-agent-teams-mcp -a claude-code` 与 `npx mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code`, 三次结果一致, 后两次无 manifest 拉取, 无覆盖提示

## 10. OpenSpec 校验

- [x] 10.1 运行 `openspec validate add-bundle-resolver --strict` 通过
