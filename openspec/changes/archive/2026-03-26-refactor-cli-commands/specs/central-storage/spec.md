## MODIFIED Requirements

### Requirement: 服务定义文件存储

系统 SHALL 将每个 MCP 服务定义保存为 `~/.mcps-manager/servers/{name}.json`, 文件权限 600.

#### Scenario: 服务定义文件结构

- **WHEN** 一个 MCP 服务被添加到中央仓库
- **THEN** 服务定义文件包含 `name` (服务名), `source` (来源 URL, 本地安装为 `local`, 通过 install 安装的为原始 URL 或 GitHub repo), `default` (基础配置, 含 transport/command/args/env 等), `overrides` (per-agent 配置覆盖, 可为空对象)

#### Scenario: source 字段记录来源

- **WHEN** 通过 `mcpsmgr install` 安装服务
- **THEN** source 字段 SHALL 记录用户提供的原始输入 (URL 或 `owner/repo` 格式), 用于 `update` 命令回溯来源

#### Scenario: custom-install 的 source 标记

- **WHEN** 通过 `mcpsmgr custom-install` 安装服务
- **THEN** source 字段 SHALL 设为 `local`

#### Scenario: 文件权限

- **WHEN** 服务定义文件被创建
- **THEN** 文件权限 MUST 设置为 600 (仅所有者可读写)
