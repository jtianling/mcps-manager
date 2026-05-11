## MODIFIED Requirements

### Requirement: 服务定义文件存储

系统 SHALL 将每个 MCP 服务定义保存为 `~/.mcps-manager/servers/{name}.json`, 文件权限 600.

服务定义的 schema 在 `source` 字符串字段基础上, 新增两个**可选**字段 `repoName` 与 `bundleId`, 用于支持 source-bundle-resolver 的精准反查. 旧 `servers/*.json` 缺失这两个字段 SHALL 被静默接受, 不触发迁移或错误.

#### Scenario: 服务定义文件结构

- **WHEN** 一个 MCP 服务被添加到中央仓库
- **THEN** 服务定义文件包含
  - `name` (服务名)
  - `source` (原始 GitHub URL / `owner/repo` 字符串 / 本地目录路径 / 字符串 `"local"`)
  - `default` (基础配置, 含 transport/command/args/env 等)
  - `overrides` (per-agent 配置覆盖, 可为空对象)
  - **可选** `repoName` (从 GitHub 远端归一化得到的 repo basename, 例如 `cross-agent-teams-mcp`)
  - **可选** `bundleId` (确定性 ID, 形如 `git:https://github.com/<owner>/<repo>`, 用于关联 `bundles.json` 中的 bundle)
  - 当 source 类型为 GitHub (manifest 安装) 时, `repoName` 与 `bundleId` MUST 同时写入; 其它来源 (local / 没有 GitHub URL 的 README fallback) SHALL 不写这两个字段

#### Scenario: source 字段记录来源

- **WHEN** 通过 `mcpsmgr install <owner/repo>` 或 `mcpsmgr install <github-url>` 安装服务
- **THEN** `source` 字段 SHALL 记录用户提供的原始输入字符串 (`owner/repo` 或归一化前的 GitHub URL), 用于 `update` 命令回溯来源; 同时 `repoName` 与 `bundleId` SHALL 基于 `normalizeGitUrl` 派生写入

#### Scenario: 本地安装的 source 标记

- **WHEN** 通过 `mcpsmgr install <path>` (本地目录或 JSON 文件) 安装服务
- **THEN** `source` 字段 SHALL 设为字符串 `"local"`, 除非本地 JSON 中显式提供了 `source` 字段 (ServerDefinition 形状); `repoName` 与 `bundleId` SHALL 不被写入

#### Scenario: 文件权限

- **WHEN** 服务定义文件被创建
- **THEN** 文件权限 MUST 设置为 600 (仅所有者可读写)

#### Scenario: servers 目录按需创建

- **WHEN** 用户执行首次 `mcpsmgr install` 但 `~/.mcps-manager/servers/` 目录不存在
- **THEN** 系统 SHALL 在写入前自动创建 `~/.mcps-manager/` (权限 700) 和 `~/.mcps-manager/servers/` (默认权限)

#### Scenario: 读取缺失新字段的旧服务定义

- **WHEN** 读取一个不含 `repoName` / `bundleId` 字段的 `servers/<name>.json`
- **THEN** 系统 SHALL 正常解析并返回 ServerDefinition (两个字段为 `undefined`); 该 server 仅可通过 server name 命中, 不会通过 repoName 反查到 bundle

## ADDED Requirements

### Requirement: Bundle 存储文件

系统 SHALL 在 `~/.mcps-manager/bundles.json` 维护远端仓库 → 本地多 server 的 1→N 映射. 该文件与 `servers/` 目录共存, 由 `install` / `uninstall` 命令同步维护.

#### Scenario: bundles.json 创建时机

- **WHEN** 任一 install 写入了带 `bundleId` 的 ServerDefinition, 而 `~/.mcps-manager/bundles.json` 尚不存在
- **THEN** 系统 SHALL 创建该文件 (父目录权限 700, 文件权限 600), 写入对应 bundle 条目

#### Scenario: bundles.json 缺失不阻断读

- **WHEN** 任何只读操作 (例如 `add <kebab>` 走 resolver) 发现 bundles.json 不存在
- **THEN** 系统 SHALL 把它当作空 bundle 集合处理, 不抛错; bundle 反查全部退化为 not-found

#### Scenario: bundles.json 损坏

- **WHEN** bundles.json 存在但 JSON 解析失败
- **THEN** 系统 SHALL 报错并退出非零, 提示用户手动删除或修复; SHALL NOT 自动覆盖以避免丢数据
