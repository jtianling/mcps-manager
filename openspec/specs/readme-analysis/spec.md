## Purpose

对 GitHub 仓库 README 实施规则化分析, 抽取 MCP server 配置 (优先级 P1-P4 + manual 兜底), 取代原本基于 LLM 的分析流程.

## Requirements

### Requirement: README 拉取策略

系统 SHALL 对 GitHub 仓库的 README 实现 fetch 首选, `gh` CLI 降级的拉取链.

#### Scenario: fetch README.md 成功

- **WHEN** 输入为 `owner/repo` 或 `https://github.com/owner/repo[/...]`, 且仓库默认分支存在 `README.md`
- **THEN** 系统 SHALL 使用 `fetch https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md` 获取 README 内容, 返回纯文本字符串

#### Scenario: 大小写兜底

- **WHEN** `README.md` 404
- **THEN** 系统 SHALL 再尝试 `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/readme.md`

#### Scenario: gh CLI 降级

- **WHEN** 两个 raw URL 均 404 且本机 `gh` 命令可执行
- **THEN** 系统 SHALL 执行 `gh api /repos/{owner}/{repo}/readme --jq .content`, 对 stdout 做 base64 解码, 返回 README 字符串

#### Scenario: 全部失败

- **WHEN** fetch 两次均 404 且 `gh` 不可用或退出码非零
- **THEN** 系统 SHALL 抛出含仓库名的错误, 引导上层降级到 manual 向导

### Requirement: `claude mcp add` CLI 行抽取 (P1)

系统 SHALL 从 README 的 fenced code block 内扫描 `claude mcp add` 行, 作为第一优先级抽取源.

#### Scenario: 标准 `claude mcp add name cmd args` 行

- **WHEN** 某个 fenced code block 内首行是 `claude mcp add blender uvx blender-mcp`
- **THEN** 系统 SHALL 抽出 `name=blender`, `command=uvx`, `args=["blender-mcp"]`, `env={}`, `transport=stdio`

#### Scenario: 含 `-e KEY=VAL` flag

- **WHEN** 某 fenced code block 内有 `claude mcp add github -e GITHUB_TOKEN=xxx -- npx -y @modelcontextprotocol/server-github`
- **THEN** 系统 SHALL 抽出 `name=github`, env 键包含 `GITHUB_TOKEN` (值不读取, 交由用户输入), command/args 从 `--` 后取

#### Scenario: 含 `--transport http --url`

- **WHEN** 某 fenced code block 内有 `claude mcp add remote-srv --transport http --url https://example.com/mcp`
- **THEN** 系统 SHALL 抽出 `transport=http`, `url=https://example.com/mcp`

#### Scenario: 裸文中的 `claude mcp add` 不计入

- **WHEN** `claude mcp add` 出现在非 fenced 段落 (普通正文 / 内联 code 而非 fenced block)
- **THEN** 系统 SHALL NOT 抽取, 视为叙述性文字

### Requirement: `mcpServers` JSON block 抽取 (P2)

系统 SHALL 从 README 的 fenced JSON block 中识别 `mcpServers` 形状的配置.

#### Scenario: 单 server 的 mcpServers block

- **WHEN** fenced json block 内为 `{"mcpServers": {"figma": {"command": "npx", "args": ["-y", "figma-mcp"]}}}`
- **THEN** 系统 SHALL 抽出 `name=figma`, `command=npx`, `args=["-y", "figma-mcp"]`

#### Scenario: 多 server 的 mcpServers block

- **WHEN** fenced json block 内 `mcpServers` 有多个条目
- **THEN** 系统 SHALL 交互式提示用户选择要安装的 server (checkbox, 默认全选)

#### Scenario: env 键抽取

- **WHEN** server 配置含 `"env": {"API_KEY": "your-key-here"}`
- **THEN** 系统 SHALL 将 `API_KEY` 加入 `requiredEnvVars`, 值字段 (`your-key-here` 等占位符) 不读取

### Requirement: 裸 `{command, args}` JSON 兜底 (P3)

系统 SHALL 在未找到 `mcpServers` 形状时, 尝试抽取顶层即为 `{command, args}` 或 `{url, headers}` 的配置.

#### Scenario: 裸 stdio 配置

- **WHEN** fenced json block 内容是 `{"command": "npx", "args": ["-y", "@scope/pkg"]}`
- **THEN** 系统 SHALL 抽出 command/args, name 默认使用 `owner/repo` 中的 repo 部分, 并在最终确认 prompt 中允许用户修改

#### Scenario: 裸 http 配置

- **WHEN** fenced json block 内容是 `{"url": "https://...", "headers": {...}}` 或 `{"serverUrl": "...", "headers": {...}}`
- **THEN** 系统 SHALL 抽出 url (或 serverUrl) 为 http transport

### Requirement: manifest 兜底 (P4)

系统 SHALL 在 P1-P3 均未命中时, 尝试拉取仓库的 `package.json` 或 `pyproject.toml` 推断配置.

#### Scenario: package.json 存在

- **WHEN** P1-P3 均失败, 且 `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/package.json` 存在
- **THEN** 系统 SHALL 读取 `name` 字段, 构造 `command=npx`, `args=["-y", <name>]`, `transport=stdio`, `env={}`

#### Scenario: pyproject.toml 存在

- **WHEN** P1-P3 和 package.json 均不可用, 且 `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/pyproject.toml` 存在
- **THEN** 系统 SHALL 读取 `[project].name` 字段, 构造 `command=uvx`, `args=[<name>]`, `transport=stdio`, `env={}`

#### Scenario: 所有兜底均失败

- **WHEN** P1-P4 均未命中
- **THEN** 系统 SHALL 抛出清晰错误, 由 `install` 命令降级到 manual 向导

### Requirement: P1 权威与 P2 env 键合并

当 P1 和 P2 同时命中时, 系统 SHALL 以 P1 的 name/command/args/transport 为主, 仅从 P2 补充 env 键名.

#### Scenario: P1 有结果, P2 提供 env 键

- **WHEN** `claude mcp add blender uvx blender-mcp` 给出 command/args, 但没有 `-e`; 同一 README 另一个 `mcpServers` JSON block 显示 `env: {BLENDER_HOST: "..."}`
- **THEN** 系统 SHALL 输出 `command=uvx, args=["blender-mcp"], requiredEnvVars=["BLENDER_HOST"]`

#### Scenario: P1 和 P2 的 name 冲突

- **WHEN** P1 的 name 与 P2 首个 key 不同
- **THEN** 系统 SHALL 取 P1 的 name

### Requirement: 抽取失败降级到 manual

系统 SHALL 在规则化分析完全失败时, 提示用户并降级到 manual 向导.

#### Scenario: 全部优先级失败后的用户提示

- **WHEN** P1-P4 均失败, `install` 命令调用者仍希望继续
- **THEN** 系统 SHALL 显示 "Rule-based analysis could not extract MCP config from this repo." 后询问 "Configure manually instead?", 用户确认后进入 manual 向导
