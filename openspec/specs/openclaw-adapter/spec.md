## Purpose

为 OpenClaw 编程 agent 提供配置适配器, 处理 JSON5 格式的配置文件读写.

## Requirements

### Requirement: OpenClaw Adapter

系统 SHALL 提供 OpenClaw 的配置适配器, 操作 `~/.openclaw/openclaw.json` (全局文件, JSON5 格式).

#### Scenario: 读取已有配置

- **WHEN** `~/.openclaw/openclaw.json` 存在且包含 `mcpServers` 字段
- **THEN** adapter 使用 JSON5 解析文件, 提取 `mcpServers` 下所有 MCP 服务条目

#### Scenario: 读取包含注释的配置

- **WHEN** `~/.openclaw/openclaw.json` 包含 JSON5 注释 (// 或 /* */) 和尾逗号
- **THEN** adapter 正确解析文件内容, 不报错

#### Scenario: 读取不存在的配置文件

- **WHEN** `~/.openclaw/openclaw.json` 不存在
- **THEN** adapter 返回空的服务器记录

#### Scenario: 写入新 stdio 服务

- **WHEN** 向 OpenClaw 添加一个 stdio 类型的 MCP 服务, 且有 env vars
- **THEN** adapter 读取 `~/.openclaw/openclaw.json` (不存在则创建 `~/.openclaw/` 目录和文件), 在 `mcpServers` 下添加服务条目, 使用 env command wrapper 格式, 不包含 `env` 字段, 保留文件中已有的其他字段和服务条目

#### Scenario: 写入新 http 服务

- **WHEN** 向 OpenClaw 添加一个 http 类型的 MCP 服务
- **THEN** adapter 在 `mcpServers` 下添加服务条目, 格式为 `{ "url": "...", "headers": {...} }`

#### Scenario: 同名冲突

- **WHEN** `~/.openclaw/openclaw.json` 中 `mcpServers` 下已存在同名服务
- **THEN** adapter 抛出冲突错误, 不修改文件

#### Scenario: 移除服务

- **WHEN** 从 OpenClaw 配置中移除一个 MCP 服务
- **THEN** adapter 从 `mcpServers` 中删除该条目, 保留其他所有条目和字段

#### Scenario: 检查服务是否存在

- **WHEN** 查询 OpenClaw 配置中某服务是否存在
- **THEN** adapter 返回该服务名是否在 `mcpServers` 中

### Requirement: JSON5 文件读写

系统 SHALL 提供 JSON5 文件的读写工具函数, 用于 OpenClaw 适配器.

#### Scenario: 读取 JSON5 文件

- **WHEN** 读取一个包含 JSON5 语法 (注释, 尾逗号) 的文件
- **THEN** 系统使用 `json5` 库正确解析并返回对象

#### Scenario: 读取不存在的文件

- **WHEN** 读取一个不存在的 JSON5 文件
- **THEN** 系统返回空对象 `{}`

#### Scenario: 写入文件

- **WHEN** 写入数据到 JSON5 文件路径
- **THEN** 系统使用标准 JSON.stringify 格式化输出 (2 空格缩进, 末尾换行), 如果目录不存在则自动创建
