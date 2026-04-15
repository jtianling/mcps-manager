## Purpose

管理 `~/.mcps-manager/` 中央仓库的服务定义文件存储. 中央目录按需由首次 `install` 自动创建, 不再需要显式的初始化命令.
## Requirements
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

