## MODIFIED Requirements

### Requirement: install 从本地 JSON 文件添加

系统 SHALL 支持 `mcpsmgr install <path/to/file.json>` 形态, 对多种已知 MCP 配置形状做嗅探.

#### Scenario: install 指向单 server JSON

- **WHEN** 用户执行 `mcpsmgr install ./mcp.json` 且文件是已知形状 (ServerDefinition / mcpServers / mcp), 含单个 server
- **THEN** 系统 SHALL 按 `local-source-analysis` 的嗅探策略解析, 写入中央仓库

#### Scenario: install 指向多 server JSON

- **WHEN** 用户执行 `mcpsmgr install ./claude-code.mcp.json` 且文件中 `mcpServers` 含多个条目
- **THEN** 系统 SHALL 展示 checkbox 多选 (默认全选), 对选中的每个条目分别写入中央仓库. checkbox SHALL 支持 j/k vim 键导航, 且列表到达边界时 SHALL 停止而非循环.

#### Scenario: 文件不是合法 JSON

- **WHEN** 文件内容不是合法 JSON
- **THEN** 系统 SHALL 报错 "File is not valid JSON: <path>"
