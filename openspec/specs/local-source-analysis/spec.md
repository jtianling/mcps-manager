## Purpose

支持从本地目录或本地 JSON 文件安装 MCP server, 通过 manifest 探测和多形状 JSON 嗅探生成 `ServerDefinition`.

## Requirements

### Requirement: 本地目录通过 manifest 探测

系统 SHALL 支持 `mcpsmgr install <path/to/dir>` 形态, 根据目录下的 manifest 推断 MCP server 配置.

#### Scenario: Node.js 项目

- **WHEN** 用户执行 `mcpsmgr install ./my-node-mcp`, 目录下有 `package.json` 且 `bin` 字段有条目
- **THEN** 系统 SHALL 使用 `package.json.name` (或 `bin` 的首个 key) 作为默认 name, 构造 `command=npx`, `args=["-y", <absolute-dir-path>]`, `transport=stdio`, 并进入交互式 env 输入循环 (用户可添加任意 env 键值, 留空表示结束)

#### Scenario: Python 项目

- **WHEN** 用户执行 `mcpsmgr install ./my-python-mcp`, 目录下有 `pyproject.toml`
- **THEN** 系统 SHALL 使用 `[project].name` (或 `pyproject.toml` 中 `[tool.poetry].name` / fallback 到目录名) 作为默认 name, 构造 `command=uvx`, `args=["--from", <absolute-dir-path>, <name>]`, `transport=stdio`

#### Scenario: 无 manifest

- **WHEN** 目录下既无 `package.json` 也无 `pyproject.toml`
- **THEN** 系统 SHALL 报错并建议用户提供 `.mcp.json` 或走 manual 向导

#### Scenario: source 字段

- **WHEN** 通过本地目录路径安装
- **THEN** 生成的 `ServerDefinition.source` SHALL 为字符串 `"local"`

### Requirement: 本地 JSON 多形状嗅探

系统 SHALL 对 `mcpsmgr install <path/to/file.json>` 尝试多个已知形状的解析顺序, 直到命中.

#### Scenario: ServerDefinition 形状

- **WHEN** JSON 顶层含 `name` (string), `default` (object, 含 `transport`), 允许含 `overrides` (object)
- **THEN** 系统 SHALL 将其作为 mcpsmgr 原生定义直接导入, 保留 `overrides` 字段内容

#### Scenario: Claude Code / Gemini 的 mcpServers 形状

- **WHEN** JSON 顶层含 `mcpServers` (object, 非空)
- **THEN** 系统 SHALL 使用 Claude Code adapter 的 `fromAgentFormat` 依次解析每个条目, 多条目时交互式让用户 checkbox 多选 (默认全选)

#### Scenario: OpenCode 的 mcp 形状

- **WHEN** JSON 顶层含 `mcp` (object, 非空) 且不含 `mcpServers`
- **THEN** 系统 SHALL 使用 OpenCode adapter 的 `fromAgentFormat` 依次解析每个条目, 处理多条目同上

#### Scenario: Antigravity 的 `serverUrl` 形状

- **WHEN** JSON 顶层含 `mcpServers` 且至少一个条目含 `serverUrl` 字段
- **THEN** 系统 SHALL 使用 Antigravity adapter 的 `fromAgentFormat` 解析这类 http 型条目

#### Scenario: 无任何已知形状

- **WHEN** 尝试所有形状后仍无法解析出至少一个合法 `DefaultConfig`
- **THEN** 系统 SHALL 报错 "No recognizable MCP server shape in <path>", 列出已尝试的形状类型

#### Scenario: 多 server 交互式选择

- **WHEN** 从 `mcpServers` 或 `mcp` 对象中解析出多个条目
- **THEN** 系统 SHALL 使用 `@inquirer/prompts` 的 checkbox 组件展示所有条目 (默认全选), 用户确认后对每个选中条目逐个写入中央仓库

#### Scenario: 同名冲突

- **WHEN** 本地 JSON 中的某个 server name 与中央仓库已有服务同名, 且未指定 `--force`
- **THEN** 系统 SHALL 交互式询问是否覆盖, 用户取消则跳过该条目继续处理其它

#### Scenario: source 字段

- **WHEN** 通过本地 JSON 文件安装
- **THEN** 生成的 `ServerDefinition.source` SHALL 为 JSON 中显式提供的 source (若 ServerDefinition 形状); 否则为字符串 `"local"`
