## Why

当前 `mcpsmgr add` 对"远端仓库"和"中央 server 名"采用两条独立分支: `add <owner/repo>` 永远走远端 manifest 拉取并对已存在条目询问覆盖; `add <kebab>` 只能命中与 server name 严格相等的中央条目. 当同一个远端仓库 (例: `jtianling/cross-agent-teams-mcp`) 通过 manifest 一次性声明多个 server (`cross-agent-teams` + `cross-agent-teams-channel`) 时, 用户期待"首次 `add jtianling/cross-agent-teams-mcp` 与后续 `add cross-agent-teams-mcp` 效果完全一致"无法实现 — 后者作为 bareword, 没有任何能反查回多 member 集合的索引.

引入 skillsmgr 已验证的"双表 + 确定性键"反查设计 (`source` 字段 + `bundles.json` + 精准 `resolve(input)`), 让多 server 远端仓库装入后可被多种等价输入精准命中, 不再二次拉远端, 不再询问覆盖.

## What Changes

- **新增 bundle 存储**: 在 `~/.mcps-manager/` 下增加 `bundles.json`, key 为确定性 `bundleId = "git:" + normalizedUrl`, value 包含 `members: string[]` (该 bundle 对应的全部中央 server name).
- **`ServerDefinition` 增加 `source` 字段** (可选, 类型 `{ type: "git", url, repoName }`): 标记本条 server 来自哪个远端仓库; 旧条目缺失该字段时系统正常工作, 只是无法走 repoName 反查.
- **新增 source resolver**: 输入 `URL` / `owner/repo` / `kebab` 三种形态通过精准等值匹配 (无模糊/子串扫描) 收敛到 `{ kind: "server" | "bundle" | "not-found" }`.
- **`add` 命令重构**: 入口先调 resolver; 命中 `bundle` 或 `server` 直接写入 agent (不拉远端, 不问覆盖); 仅当输入为 `owner/repo` / URL 且 resolver 返回 `not-found` 时才 fallback 到现有 manifest 拉取路径.
- **`install` 写入 source + 同步 bundle**: GitHub manifest 路径在写入 `servers/<name>.json` 时附 `source` 字段, 同时往 `bundles.json` 创建/更新 bundleId 对应条目, `members` 设为本次 manifest 涉及的全部 server name.
- **`remove` / `uninstall` 同步维护 bundle members**: 移除 server 时从其所属 bundle 的 `members` 移除; members 空了则删除该 bundle 条目.
- **不破坏现有命令**: `deploy` / `update` / `list` / README 单 server fallback 流程不变.

## Capabilities

### New Capabilities
- `source-bundle-resolver`: 对 `add` / `install` / `remove` 命令的输入做统一精准解析的中央服务. 维护远端仓库 URL → 多个本地 server 的 1→N 反查表 (bundles.json), 暴露 `resolve(input)` 接口与 bundle 读写 API; 输入归一化逻辑 (`normalizeGitUrl`, `makeBundleId`) 在此能力内部实现.

### Modified Capabilities
- `project-operations`: `add` 命令的解析与分发流程变更 — 不再由 `classifyAddInput` 直接二分到 central / GitHub 路径, 而是先经 resolver; 命中 bundle 时遍历 members 写入 agent.
- `server-management`: `install` 写入 server 时必须附 `source` 并更新 bundle; `uninstall` 必须同步维护 bundle members.
- `central-storage`: 中央存储新增 `bundles.json` 文件; `ServerDefinition` 类型增加可选 `source` 字段.

## Impact

- 新增代码: `src/utils/url-normalize.ts`, `src/utils/bundle-store.ts`, `src/services/source-resolver.ts`
- 修改代码: `src/types.ts` (`ServerDefinition.source`), `src/utils/paths.ts` (`bundlesFile`), `src/commands/add.ts` (resolver-first dispatch), `src/commands/install.ts`, `src/commands/uninstall.ts` / `remove.ts`, `src/install/manifest-apply.ts` (生成带 source 的 ServerDefinition)
- 新增测试: `src/__tests__/url-normalize.test.ts`, `source-resolver.test.ts`, 扩充 `add` / `install` / `uninstall` 既有用例覆盖 bundle 维护与 resolver 行为
- 兼容性: 旧 `servers/*.json` 缺失 `source` 不影响读取与现有 add-by-server-name 行为; 用户重装多 server 仓库后获得 bundle 反查能力. 无 migration 脚本.
- 不涉及: 网络协议、外部 API、依赖升级.
