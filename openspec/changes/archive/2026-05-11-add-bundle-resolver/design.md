## Context

`mcpsmgr add` 当前由 `classifyAddInput` 把输入二分:
- kebab → `runAddFromCentral`: `serverExists(input)` 命中即写, 否则报错.
- `owner/repo` 或 URL → `runAddFromGitHub`: 每次拉 manifest, 写中央时若同名 server 已存在还要交互确认覆盖.

当一个远端仓库通过 manifest 装入多个 server (`jtianling/cross-agent-teams-mcp` → `cross-agent-teams` + `cross-agent-teams-channel`), 上述结构没有任何索引能把"仓库名/URL"反查回多个本地 server name 集合. 用户期望"首次远端 add 与之后的等价 add 完全幂等等价"无法满足.

`skillsmgr-creator` 在 `default` team 复述了它们已验证的方案核心: 给本地条目加 `repoName`, 用确定性 `bundleId = "git:" + normalizedUrl` 作为远端 → 本地 1→N 的单一真相源, resolver 全程精准等值匹配. 本 change 把这套设计移植到 mcpsmgr.

## Goals / Non-Goals

**Goals:**
- `add jtianling/cross-agent-teams-mcp` (首次/复用) 与 `add cross-agent-teams-mcp` (kebab 跟仓库同名) 两条命令在已安装状态下产生**完全相同的副作用**: 同一组 members 全部写入选定 agent, 中央 servers/ 内**零写**, 无覆盖提示, 无 manifest 拉取.
- 输入解析全程精准等值匹配 (URL 归一化等值, `repoName` 等值, server name 等值), 不使用模糊匹配/子串包含.
- 旧 `servers/*.json` (缺 `repoName` / `bundleId`) 无需迁移即可继续工作, 仅失去 repoName 反查能力.
- 不破坏现有 `deploy` / `update` / `list` / README fallback / 本地 install 路径.

**Non-Goals:**
- 不引入并发文件锁 (单进程内 RMW 即可, 与现有 servers/ 写策略一致).
- 不重新设计 `update` / `refresh` / `deploy` 命令; 它们对 `repoName`/`bundleId` 字段透明.
- 不为非 GitHub 远端 (GitLab/Bitbucket) 引入 bundle 概念; 这些仍按 manifest 拉取或拒绝.
- 不写迁移命令; 不主动重写老 servers/*.json.

## Decisions

### D1. `repoName` + `bundleId` 嵌入 ServerDefinition, 而非独立索引表

**Choice**: 在 `ServerDefinition` 上加两个**可选**字段 `repoName?: string` 与 `bundleId?: string`, 与现有 `source: string` 共存.

**Why**: 与 skillsmgr 一样, 让"远端 → 本地"反查的真相源分布在 `bundles.json` (bundleId → members) 与 `servers/*.json` (server → bundleId/repoName) 两端, 不需要单独 maintain "url → server name list" 的反向索引文件. uninstall / 手工修改 servers/ 时, 真相源天然一致.

**Alternative considered**: 把 `repoName` / `bundleId` 全部放进 `bundles.json` 的每个 member 元数据里, 不嵌入 ServerDefinition. 拒绝, 因为 resolver 在 bareword → repoName 阶段需要扫 servers/, 把字段嵌入条目本身才能避免额外文件 join.

### D2. `source` 字段不动, 新增 `bundleId`/`repoName` 而不是把 `source` 重写为对象

**Choice**: `ServerDefinition.source: string` (原始用户输入) 保留不变, 旁挂两个新字段.

**Why**: 避免破坏 `update` 命令既有"按字符串 source 回溯"逻辑. 旧 servers/ 文件读到后 `repoName/bundleId` 为 undefined, 是合法状态.

**Alternative considered**: 把 `source` 升级为 `{ raw, type, url, repoName }` 对象. 拒绝, 改动面太大且需要兼容读两种 schema.

### D3. `bundleId = "git:" + normalizeGitUrl(url)`, 单文件 `bundles.json`

**Choice**: 所有 bundles 写在 `~/.mcps-manager/bundles.json` 单文件里, key 为完全确定性的 `bundleId`. `normalizeGitUrl`:
- 接受 `owner/repo` / `https://github.com/owner/repo[.git][/]` / `git@github.com:owner/repo.git`
- 输出 `https://github.com/<owner>/<repo>` (无 `.git`, 无末尾斜杠)
- host & scheme 小写; path 大小写保留
- 非 `github.com` host → 返回 `null`

**Why**: 跟 skillsmgr 的 `makeBundleId('git', url) = "git:" + url` 完全对齐. 单文件让 read-modify-write 简单, bundles 数量小 (一个用户量级最多几十).

**Alternative considered**: 每个 bundle 独立文件 `bundles/<sanitized-id>.json`. 拒绝, 增加文件 IO 与目录扫描成本, 没有收益.

### D4. Resolver 解析路径

```
resolve(input):
  shape = detectShape(input)
    # "url" if startsWith http(s)://github.com
    # "owner-repo" if matches `^[\w.-]+/[\w.-]+$` (no `://`, no slash count != 2)
    # "kebab" if matches `^[a-z][a-z0-9-]*$`
    # else "invalid"

  if shape == "url":
    n = normalizeGitUrl(input); if null → not-found(url)  # non-GitHub URL
    return bundleLookupOrNotFound(makeBundleId('git', n), inputForm: 'url')

  if shape == "owner-repo":
    n = normalizeGitUrl(input)  # always succeeds for valid owner/repo
    return bundleLookupOrNotFound(makeBundleId('git', n), inputForm: 'owner-repo')

  if shape == "kebab":
    if serverExists(input): return { kind: "server", name: input }
    matches = [s for s in listServerDefinitions() if s.repoName === input]
    if len(matches) == 0: return { kind: "not-found", inputForm: "kebab" }
    bundleIds = set(s.bundleId for s in matches if s.bundleId)
    if len(bundleIds) > 1: return { kind: "not-found", inputForm: "ambiguous-reponame", details: [...] }
    bundle = readBundle(bundleIds[0])
    return { kind: "bundle", bundleId, url, members: bundle.members }

  return { kind: "not-found", inputForm: "invalid" }
```

**Why**: `kebab → server name` 必须**优先于** `kebab → repoName`, 这样 `add cross-agent-teams` 仍精准对应单个 server, 不被 repoName 反查到整组 members. 整链条全是 dict / set 等值查询, 不模糊匹配, 不串子匹配.

### D5. `add` 命令分发逻辑

```
add(input, options):
  result = resolve(input)
  if result.kind == "server" or "bundle":
    # 不读 manifest, 不写 servers/, 仅向选定 agent 写入
    deployToAgents(serverNames=members or [name], agents=options.agent or prompt)
  elif result.kind == "not-found":
    if result.inputForm in ("url", "owner-repo"):
      # 旧 GitHub manifest 拉取路径
      runAddFromGitHub(...)  # 内部成功后会更新 bundle + 标 repoName/bundleId
    elif result.inputForm == "ambiguous-reponame":
      error("Ambiguous bareword ... use owner/repo to disambiguate")
    else:
      error("Server not found in central repository. Use mcpsmgr install to add it.")
```

`runAddFromGitHub` 内部已有"写中央 + 写 agent"的 dual write. 改造它使得:
- 每个写入的 `ServerDefinition` 带上 `repoName` 与 `bundleId`.
- 全部 servers 写完之后调用 `upsertBundle(bundleId, { url, members: [写入的全部 server name], selectionMode: 'all' })`.
- 不再询问"中央仓库已存在, 是否覆盖" — 因为新流程的语义是 "已存在 bundle 时 resolver 会先命中, 不会到 runAddFromGitHub"; 仍可能存在用户手动改了 manifest 后想强制重 install, 这种 case 走 `mcpsmgr update` 而不是 add 的覆盖确认.

### D6. `install` 与 `uninstall` 联动

- `install`: 走 GitHub manifest 路径或 README fallback (前提是输入是 GitHub 形态) → 写 `repoName`/`bundleId` 到 server JSON → 安装完成调 `upsertBundle`. 本地路径 install 不写这两个字段, 也不动 bundles.json.
- `uninstall <name>`: 读 ServerDefinition; 若有 `bundleId`, 走 `removeMember(bundleId, name)`, 空了就删 bundle; 文件删除照常.

### D7. 错误与冲突处理

- `repoName` 多 bundle 命中 → 报错并要求 owner/repo 消歧 (D4 中已处理), 不静默选第一个.
- bundles.json JSON 损坏 → 报错退出, 不自动覆盖 (避免数据丢失).
- 非 GitHub URL (`https://gitlab.com/...`) → resolve 返回 not-found(invalid-or-non-github); add 命令报与现有一致的错误.
- ServerDefinition 上 `bundleId` 指向 bundles.json 里不存在的 id → 视作 bundle 已被外部删除, 该 server 仅按 server name 命中, 不报错.

## Risks / Trade-offs

- **[风险]** 用户手工编辑 `servers/<name>.json` 把 `repoName` 改成与其他仓库重名 → resolve 报"ambiguous-reponame", 用户必须用 owner/repo 形式. **Mitigation**: 文档说明 `repoName` 必须与远端 repo basename 一致; 默认值由 install 自动写, 用户改坏是边界用户.

- **[风险]** `bundles.json` 与 `servers/` 出现漂移 (例如直接 `rm servers/foo.json`, 没走 uninstall) → bundle.members 含失效 name → resolver 返回 bundle 时 members 里有不存在的 server. **Mitigation**: `add` 写入时若 member 对应 server 文件不存在, 跳过并 warn, 不中断其他 members.

- **[风险]** `cross-agent-teams-mcp` 这类输入既可能是用户期望的"仓库名反查" (bundle), 也可能未来真的有人发布一个叫 `cross-agent-teams-mcp` 的中央 server. **Trade-off**: D4 优先 server name 命中, 保证已发布 server 永远赢; 这意味着同名 server 一旦存在, repoName 反查就被遮蔽, 用户需要用 owner/repo 形式. 文档要写清楚.

- **[Trade-off]** `bundles.json` 单文件不加锁 → 极端并发 (两个 `install` 同时跑) 可能有 last-write-wins. 与 servers/ 的现状一致, 当前不修.

## Migration Plan

无外部 migration 步骤. 部署后:
- 新 install / add(GitHub) 会自动产生 `repoName` + `bundleId` + bundles.json 条目.
- 老 servers/*.json (缺这两个字段) 仍可读, 但只能通过 server name 命中, 不能 repoName 反查.
- 想给老条目补字段的用户走 `mcpsmgr uninstall && install` 重装一次即可.

## Open Questions

1. **本地路径 install 是否需要 bundle 概念?** 当前决定 *不* 引入 — 本地路径没有 URL 形态, repoName 反查没意义. 如果将来需要 "本地多 server manifest 反查", 可以扩 `bundleId = "local:" + normalizedAbsPath`. 暂不做.
2. **`add` fallback 到 manifest 拉取路径时, 是否还保留 "中央已存在, 是否覆盖" 提示?** 决定: **保留**, 仅作 defensive — 正常情况 bundle 已存在时 resolver 先命中, 不会走到 fallback; 走到 fallback 的边界 case (用户手动删了 bundles.json 但留下 servers/) 时, 覆盖确认仍是合理保护.
