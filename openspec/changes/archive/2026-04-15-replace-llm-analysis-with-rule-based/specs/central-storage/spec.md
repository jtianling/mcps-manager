## REMOVED Requirements

### Requirement: Setup 初始化中央仓库

**Reason**: `mcpsmgr setup` 命令原本是为了收集 GLM5 API Key 而存在. 移除 LLM 后, 目录可以按需由第一次 `install` 时自动创建, 不再需要显式初始化步骤.

**Migration**: 无需迁移. 已有 `~/.mcps-manager/` 目录保持原样; 新用户首次 `install` 时系统自动建目录. `mcpsmgr setup` 命令被移除, 调用会得到 commander 的 "unknown command" 错误.

### Requirement: config.json 结构

**Reason**: `~/.mcps-manager/config.json` 原本只用来存 GLM / Web Reader 凭据. 移除 LLM 后此文件不再有任何字段, 整个文件作废.

**Migration**: 已有 `config.json` 文件可以保留或删除, 均不影响新版运行 (代码不再读此文件).

## MODIFIED Requirements

### Requirement: 服务定义文件存储

系统 SHALL 将每个 MCP 服务定义保存为 `~/.mcps-manager/servers/{name}.json`, 文件权限 600.

#### Scenario: 服务定义文件结构

- **WHEN** 一个 MCP 服务被添加到中央仓库
- **THEN** 服务定义文件包含 `name` (服务名), `source` (来源: 原始 GitHub URL / `owner/repo` 字符串 / 本地目录路径 / 字符串 `"local"`), `default` (基础配置, 含 transport/command/args/env 等), `overrides` (per-agent 配置覆盖, 可为空对象)

#### Scenario: source 字段记录来源

- **WHEN** 通过 `mcpsmgr install <owner/repo>` 或 `mcpsmgr install <github-url>` 安装服务
- **THEN** source 字段 SHALL 记录用户提供的原始输入字符串 (`owner/repo` 或归一化前的 GitHub URL), 用于 `update` 命令回溯来源

#### Scenario: 本地安装的 source 标记

- **WHEN** 通过 `mcpsmgr install <path>` (本地目录或 JSON 文件) 安装服务
- **THEN** source 字段 SHALL 设为字符串 `"local"`, 除非本地 JSON 中显式提供了 `source` 字段 (ServerDefinition 形状)

#### Scenario: 文件权限

- **WHEN** 服务定义文件被创建
- **THEN** 文件权限 MUST 设置为 600 (仅所有者可读写)

#### Scenario: servers 目录按需创建

- **WHEN** 用户执行首次 `mcpsmgr install` 但 `~/.mcps-manager/servers/` 目录不存在
- **THEN** 系统 SHALL 在写入前自动创建 `~/.mcps-manager/` (权限 700) 和 `~/.mcps-manager/servers/` (默认权限)
