## MODIFIED Requirements

### Requirement: Agent 自动检测

系统 SHALL 在项目目录中自动检测哪些 agent 的配置文件已存在.

#### Scenario: 检测项目中的 agent

- **WHEN** 系统需要确定项目使用了哪些 agent
- **THEN** 系统检查以下文件是否存在: `.mcp.json` (Claude Code), `.codex/` 目录 (Codex CLI), `.gemini/settings.json` (Gemini CLI), `opencode.json` (OpenCode); Antigravity 和 OpenClaw 始终作为可选项列出 (因为仅全局配置)
