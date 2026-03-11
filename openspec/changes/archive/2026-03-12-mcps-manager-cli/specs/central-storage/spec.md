## ADDED Requirements

### Requirement: Setup 初始化中央仓库

系统 SHALL 提供 `mcpsmgr setup` 命令, 创建 `~/.mcps-manager/` 目录结构并交互式收集配置信息.

#### Scenario: 首次 setup

- **WHEN** 用户执行 `mcpsmgr setup` 且 `~/.mcps-manager/` 不存在
- **THEN** 系统创建 `~/.mcps-manager/` 目录 (权限 700) 和 `servers/` 子目录, 交互式要求用户输入 GLM5 API Key, 选择 GLM5 端点 (Coding 或通用), 并将配置保存到 `~/.mcps-manager/config.json` (权限 600). Web Reader API Key 默认复用 GLM5 API Key (同属智谱平台)

#### Scenario: 重复 setup

- **WHEN** 用户执行 `mcpsmgr setup` 且 `~/.mcps-manager/` 已存在
- **THEN** 系统提示配置已存在, 询问是否覆盖

### Requirement: config.json 结构

系统 SHALL 将全局配置保存在 `~/.mcps-manager/config.json` 中.

#### Scenario: 配置文件内容

- **WHEN** setup 完成后
- **THEN** config.json 包含 `glm.apiKey` (GLM5 API key), `glm.endpoint` (完整端点 URL), `webReader.apiKey` (Web Reader API key), `webReader.url` (Web Reader MCP 端点 URL)

### Requirement: 服务定义文件存储

系统 SHALL 将每个 MCP 服务定义保存为 `~/.mcps-manager/servers/{name}.json`, 文件权限 600.

#### Scenario: 服务定义文件结构

- **WHEN** 一个 MCP 服务被添加到中央仓库
- **THEN** 服务定义文件包含 `name` (服务名), `source` (来源 URL), `default` (基础配置, 含 transport/command/args/env 等), `overrides` (per-agent 配置覆盖, 可为空对象)

#### Scenario: 文件权限

- **WHEN** 服务定义文件被创建
- **THEN** 文件权限 MUST 设置为 600 (仅所有者可读写)
