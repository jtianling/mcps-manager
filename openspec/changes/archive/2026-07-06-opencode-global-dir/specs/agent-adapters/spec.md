## MODIFIED Requirements

### Requirement: OpenCode Adapter

系统 SHALL 提供 OpenCode 的配置适配器, 操作 `opencode.json` 文件.

Adapter SHALL 声明 `globalDir()` 返回 `~/.config/opencode`, 使 `--global` 写入路径为 `~/.config/opencode/opencode.json` (与 opencode 1.17.x 实测的全局配置文件一致).

#### Scenario: 读取已有配置

- **WHEN** 项目根目录存在 `opencode.json`
- **THEN** adapter 解析文件, 提取 `mcp` 下所有 MCP 服务条目

#### Scenario: 写入新服务 (stdio)

- **WHEN** 向 OpenCode 添加一个 stdio 类型的 MCP 服务
- **THEN** adapter 在 `mcp` 下添加服务条目, 格式为 `{ "type": "local", "command": ["env", "KEY=val", "<cmd>", ...] }` (有 env vars 时) 或 `{ "type": "local", "command": ["<cmd>", "<arg1>", ...] }` (无 env vars 时), 不使用 `environment` 字段

#### Scenario: 写入新服务 (http)

- **WHEN** 向 OpenCode 添加一个 http 类型的 MCP 服务且 headers 非空
- **THEN** adapter 在 `mcp` 下添加服务条目, 格式为 `{ "type": "remote", "url": "...", "headers": {...} }`

#### Scenario: 写入新服务 (http, headers 为空)

- **WHEN** 向 OpenCode 添加一个 http 类型的 MCP 服务且 headers 为空对象
- **THEN** adapter SHALL 写出 `{ "type": "remote", "url": "..." }`, SHALL NOT 包含空的 `"headers": {}` 键

#### Scenario: 全局写入

- **WHEN** 调用方以 `globalDir()` 返回的目录作为写入目录写 MCP 服务
- **THEN** adapter SHALL 写入 `~/.config/opencode/opencode.json`, 行为 (冲突检测, 保留已有字段) 与项目级写入一致

#### Scenario: 同名冲突

- **WHEN** `opencode.json` 中 `mcp` 下已存在同名服务
- **THEN** adapter 报告冲突, 不修改文件
