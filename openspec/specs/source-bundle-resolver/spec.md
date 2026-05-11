## Purpose

提供把用户输入 (GitHub URL / `owner/repo` / repo basename / 中央 server name) 精准映射到中央仓库中已有 server 或 bundle 的解析器, 并维护远端仓库 → 多 server 的 1→N bundle 映射 (`~/.mcps-manager/bundles.json`). 解析过程 MUST 基于完整字段等值匹配, 不使用模糊或子串匹配.

## Requirements

### Requirement: GitHub URL 归一化

系统 SHALL 提供 `normalizeGitUrl(input)` 工具, 把各种合法的 GitHub 远端写法归一化到统一形式 `https://github.com/<owner>/<repo>`, 用于生成确定性的 bundle key. 归一化 MUST 是幂等的.

#### Scenario: 归一化 owner/repo 简写

- **WHEN** `normalizeGitUrl("jtianling/cross-agent-teams-mcp")` 被调用
- **THEN** 返回 `https://github.com/jtianling/cross-agent-teams-mcp`

#### Scenario: 归一化 https URL

- **WHEN** `normalizeGitUrl("https://github.com/jtianling/cross-agent-teams-mcp.git/")` 被调用
- **THEN** 返回 `https://github.com/jtianling/cross-agent-teams-mcp` (去掉 `.git` 后缀与末尾斜杠)

#### Scenario: 归一化 ssh URL

- **WHEN** `normalizeGitUrl("git@github.com:jtianling/cross-agent-teams-mcp.git")` 被调用
- **THEN** 返回 `https://github.com/jtianling/cross-agent-teams-mcp`

#### Scenario: 非 GitHub URL 拒绝

- **WHEN** `normalizeGitUrl("https://gitlab.com/foo/bar")` 被调用
- **THEN** 返回 `null` 或抛出可识别错误, 调用方 SHALL 把它视为"无法纳入 bundle 体系"的输入

#### Scenario: 大小写差异收敛

- **WHEN** `normalizeGitUrl("HTTPS://GitHub.COM/Owner/Repo")` 被调用
- **THEN** host 与 scheme 部分小写化, 返回 `https://github.com/Owner/Repo` (path 部分保持原样以避免大小写敏感系统冲突)

### Requirement: Bundle 标识与存储

系统 SHALL 用确定性 ID `bundleId = "git:" + normalizeGitUrl(url)` 标识一个远端仓库 bundle, 并把所有 bundle 信息保存到单一文件 `~/.mcps-manager/bundles.json`.

#### Scenario: bundleId 由 URL 唯一确定

- **WHEN** 同一个仓库的多种输入形态 (`owner/repo` / https / ssh / 带 `.git`) 被处理
- **THEN** `makeBundleId("git", normalizeGitUrl(input))` 返回相同字符串

#### Scenario: bundles.json 结构

- **WHEN** 首次写入任一 bundle 时 `~/.mcps-manager/bundles.json` 不存在
- **THEN** 系统 SHALL 创建该文件 (父目录权限 700), 内容为
  ```json
  {
    "version": "1",
    "bundles": {
      "<bundleId>": {
        "url": "<normalizedUrl>",
        "members": ["<serverName>", ...],
        "selectionMode": "all",
        "installedAt": "<ISO8601>",
        "updatedAt": "<ISO8601>"
      }
    }
  }
  ```
  文件权限 MUST 为 600.

#### Scenario: 读 bundle 缺失文件

- **WHEN** 读取 bundle 但 `bundles.json` 不存在
- **THEN** API SHALL 返回 "bundle 集合为空" 而不是抛错; 任何反查命令 (如 `add <kebab>`) 退化到仅基于 server name 的现有行为

#### Scenario: 上 / 下层并发写入

- **WHEN** `install` 写一个 bundle 时另一个 mcpsmgr 进程也在改 `bundles.json`
- **THEN** 系统 SHALL 通过 read-modify-write 模式覆盖该文件; 当前 change 不引入文件锁, 只保证单进程内的语义正确

### Requirement: Source Resolver 接口

系统 SHALL 暴露 `resolve(input: string)` 解析器, 把用户输入精准映射到下列形态之一. 解析过程 MUST NOT 使用模糊匹配或子串扫描; 所有匹配都基于完整字段等值.

返回 `{ kind: "server", name }` | `{ kind: "bundle", bundleId, url, members }` | `{ kind: "not-found", inputForm }`, 其中 `inputForm` 用于上层决定是否走 `not-found` fallback (例如 GitHub URL/owner-repo 才 fallback 到 manifest 拉取, kebab 报错).

#### Scenario: 输入是 GitHub URL

- **WHEN** `resolve("https://github.com/jtianling/cross-agent-teams-mcp")` 被调用, 且 `bundles.json` 含 `git:https://github.com/jtianling/cross-agent-teams-mcp`
- **THEN** 返回 `{ kind: "bundle", bundleId: "git:https://github.com/jtianling/cross-agent-teams-mcp", members: ["cross-agent-teams", "cross-agent-teams-channel"] }`

#### Scenario: 输入是 owner/repo

- **WHEN** `resolve("jtianling/cross-agent-teams-mcp")` 被调用, 且 bundle 已存在
- **THEN** 系统 SHALL 先 `normalizeGitUrl` 再查 bundleId, 返回 `{ kind: "bundle", ... }`

#### Scenario: 输入是 kebab 且命中 server name

- **WHEN** `resolve("cross-agent-teams")` 被调用, 且 `~/.mcps-manager/servers/cross-agent-teams.json` 存在
- **THEN** 返回 `{ kind: "server", name: "cross-agent-teams" }`, 不再做 repoName 反查

#### Scenario: 输入是 kebab 且不命中 server name, 命中 repoName

- **WHEN** `resolve("cross-agent-teams-mcp")` 被调用, 中央仓库无 `cross-agent-teams-mcp.json`, 但有条目的 `repoName === "cross-agent-teams-mcp"`
- **THEN** 系统 SHALL 取得这些条目对应的 bundle, 返回 `{ kind: "bundle", ... }` 并附完整 `members`

#### Scenario: 多个 bundle 的 repoName 相同 (理论冲突)

- **WHEN** 两个不同 owner 的同名仓库都已安装且共享相同 `repoName`
- **THEN** 系统 SHALL 返回错误 `{ kind: "not-found", inputForm: "ambiguous-reponame" }`, 提示用户使用 `owner/repo` 形式消歧

#### Scenario: 输入完全无法解析

- **WHEN** `resolve("totally-unknown-thing")` 被调用且无任何匹配
- **THEN** 返回 `{ kind: "not-found", inputForm: "kebab" }`; 若输入是 owner/repo 或 URL 形态, `inputForm` SHALL 为 `"owner-repo"` 或 `"url"` 以便上层 fallback 到 manifest 拉取

### Requirement: Bundle 维护操作

系统 SHALL 暴露 bundle 写操作: `upsertBundle(bundleId, info)`, `removeMember(bundleId, serverName)`. 这些 API 由 `install` / `uninstall` 命令调用.

#### Scenario: 首次写入 bundle

- **WHEN** `install` 完成一个多 server 仓库的写入后调用 `upsertBundle("git:...", { url, members: ["a", "b"], selectionMode: "all" })`
- **THEN** bundles.json 中对应条目被创建; 已存在条目的 `members` SHALL 被替换为传入值; `installedAt` 保留首次创建时间, `updatedAt` 刷新

#### Scenario: 移除 bundle 内一个 member

- **WHEN** `uninstall server-a` 时该 server 属于 `git:...` bundle
- **THEN** 系统 SHALL 从 `members` 中移除 `server-a`; 余下 `members` 非空时仅刷新 `updatedAt`

#### Scenario: 最后一个 member 被移除

- **WHEN** `uninstall` 后 bundle 的 `members` 为空
- **THEN** 系统 SHALL 从 `bundles.json` 中删除该 bundle 条目
