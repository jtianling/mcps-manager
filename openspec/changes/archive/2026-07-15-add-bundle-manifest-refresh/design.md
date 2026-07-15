# Design: add-bundle-manifest-refresh

## Context

`runAdd` (`src/commands/add.ts`) 对输入的分派: `resolveInput` 返回 `kind: "bundle"` 时进入 `runAddFromBundle`, 该函数只读中央 store 定义 (`readServerDefinition`), 从不 fetch manifest.  GitHub manifest 路径 (`runAddFromGitHub` → `runAddFromManifest`) 只有 bundle 未命中 (`not-found` + url/owner-repo 形态) 才会到达.

关键事实:

- bundle 命中有三种输入形态: 完整 URL, `owner/repo`, 裸 repoName (kebab).  三者都能从 `bundle.url` 反解出 GitHub ref, 无需依赖原始输入形态.
- `applyManifest` 是纯函数, 不做 IO 不做交互; 交互 (env 提问) 发生在 `runAddFromManifest` 中 applyManifest 之前.
- `findBearerTokenEnvVar` 不依赖 env 值是否提供, 只要 manifest 声明了 Bearer header 就会在结果中写入 `bearerTokenEnvVar` — 因此预览无需 env 值也能暴露该差异.
- `upsertBundle` 对 members 是整体替换.  `runAddFromManifest` 现只把本次写入的 server 名传入, 若刷新时只选了部分 agent (如 `-a codex`), 会把其他 agent 专属成员从 bundle 记录中挤掉.
- `options.yes` 在 `runAdd` 入口已被折叠为 `force=true`.

## Goals / Non-Goals

**Goals:**

- bundle 命中时检测源仓库 manifest 更新, 有差异时让用户决定是否覆盖
- 离线 / fetch 失败时行为与现状完全一致
- 覆盖路径产出与 fresh manifest 安装完全一致 (per-agent 筛选, bearerTokenEnvVar, env 交互)
- bundle members 不因部分 agent 刷新而丢失

**Non-Goals:**

- 不改 `install` / `update` 命令
- 不改 README fallback 路径
- 不做 manifest 版本号语义比较 (无版本字段可用), 只做结果 diff
- 不自动清理 store 中已不属于新 manifest 的旧 server 定义 (如 channel), 只是不再写给不相关 agent

## Decisions

### D1: 在 runAdd 的 bundle 分支做刷新检测, 而不是改 source-resolver

resolver 保持纯查找语义.  新增流程放在 `runAdd` 的 `kind === "bundle"` 分支: 先尝试 manifest 刷新检测, 决定进 `runAddFromManifest` (覆盖) 还是 `runAddFromBundle` (现行为).  备选: 在 `runAddFromBundle` 内部做 — 拒绝, 会让该函数同时承担两条完全不同的流程.

### D2: 用 bundle.url 反解 GitHub ref

`parseGitHubSource(bundle.url)` 解析; 解析失败 (理论上 bundle.url 恒为归一化 GitHub URL) 则直接走现行为.  好处: 三种输入形态统一, 裸 repoName 输入也能享受刷新检测.

### D3: 预览 diff 的计算方式

fetch 成功后, 用与 `runAddFromManifest` 相同的变量解析规则但**只取非交互来源**构造预览输入:

- variableValues: manifest 默认值 + `--var` + `--port`
- envValues: `--var` + `process.env` (即 `readEnvVar`), 不弹任何提问; required 但缺值的 env/变量在预览阶段按缺失处理 (substitute 对 optionalDeclared 之外的缺失变量会 throw — 此时视为 "有差异", 直接进入提示流程, 让用户决定后走完整流程处理 required 提问)

diff 范围: 选中 agents 的 `applyManifest` 结果.  比较逻辑:

1. 成员名集合: `result.perAgent[selected]` 的 server 名集合 vs store 中 "属于该 bundle 且会被 runAddFromBundle 写入" 的成员集合 (即 bundle.members) — 注意旧路径把全部 members 写给每个 agent, 新 manifest 是 per-agent, 集合不同即差异
2. default 配置: 对交集中的每个 server 名, 深比较 manifest 产出的 `def.default` vs store 定义的 `default`

任一不同 → 有差异.  预览计算抛错 (unresolved required variable) → 视为有差异.

### D4: agent 选择先于 diff

diff 依赖选中 agents, 因此 agent 选择逻辑 (flag / -y / prompt) 提前到刷新检测之前执行一次, 结果同时供三条路径使用 (diff 预览, runAddFromManifest, runAddFromBundle), 避免二次提问.  注意 `--agent` 指定的 agent 不在新 manifest agents 里时: manifest 路径会报错, 但旧 bundle 路径能装 — 此情况按 "有差异" 提示, 用户同意覆盖后由 runAddFromManifest 的既有校验报错 (提示可用 agents), 拒绝则旧行为继续.  实现时直接沿用 runAddFromManifest 的校验语义即可, 不额外特判.

### D5: 覆盖确认与 -y 语义

- 交互场景: `confirm` 提示 `Manifest for <owner/repo> has changed since install. Reinstall from latest manifest (overwrites central definitions)?` (输出遵循现有英文 CLI 文案风格)
- `-y`: 视为同意覆盖, 不提问 (与 `-y` 已隐含 `force=true` 跳过 central overwrite 确认一致)
- 拒绝: fall through 到 `runAddFromBundle`, 行为与现状完全一致

依赖注入: `AddDeps` 新增 `confirmManifestRefresh: (repo: string) => Promise<boolean>`, 便于测试.

### D6: bundle members 合并

`runAddFromManifest` 末尾 upsertBundle 前, 读取既有 bundle 的 members 与本次 `bundleMembers` 求并集.  该行为对 fresh 安装无影响 (无既有 bundle), 对部分 agent 刷新保住其他成员.  实现为 manifest 路径统一行为, 不区分入口.

### D7: fetch 失败静默回退

`fetchManifest` 404 返回 undefined, 网络错误 / 无效 manifest 会 throw.  bundle 刷新检测中 catch 一切异常并回退现行为, 不打印错误 (离线是正常场景); 仅在 `undefined` (404, manifest 已被移除) 时同样静默回退.

## Risks / Trade-offs

- [预览 diff 与最终安装结果可能不同 (交互 env 输入影响 headers)] → diff 只做 "是否提示" 的门槛, 覆盖后以完整流程产出为准; 假阳性只多一次提问, 假阴性范围极小 (仅交互-only env 影响且其余全同)
- [每次 bundle 命中都发一次网络请求] → fetch 失败静默且快速回退; raw.githubusercontent 单文件, 开销可接受; 不加缓存 (YAGNI)
- [覆盖后 store 中残留旧 server 定义 (如 channel 对 codex 场景)] → 残留定义仍属 bundle 成员, claude-code 等 agent 仍需要; 不属于本次范围
- [`--var`/`--port` 在 bundle 命中分支原本被 `checkManifestOnlyFlags` 拒绝] → 调整: bundle 分支现在可能走 manifest 路径, 这两个 flag 不再无条件报错; 仅在最终落到旧定义路径 (fetch 失败 / 无差异 / 用户拒绝) 时保持原报错或降级为警告 — 采用: 落到旧路径时打印原有错误信息并退出, 语义不变 (flag 只对 manifest 生效)

## Open Questions

(无 — 需求方已确认: 提示驱动覆盖, -y 视为同意)
