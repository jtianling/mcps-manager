## Why

多个编程 agent (Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity) 都支持 MCP, 但配置格式各不相同.  给项目添加一个 MCP 服务需要手动修改多个配置文件, 格式转换容易出错, 维护成本高.  需要一个统一的命令行工具来集中管理 MCP 服务定义, 并自动部署到各 agent 的配置文件中.

## What Changes

- 新建 CLI 工具 `mcpsmgr`, 发布为 npm 包
- 中央仓库 `~/.mcps-manager/` 存储 MCP 服务定义 (含 API key 等敏感信息)
- 支持通过 URL 或 GitHub `owner/repo` 简写添加 MCP 服务
- 集成 GLM5 + 智谱 Web Reader MCP 自动分析文档, 生成 per-agent 配置
- 合并写入各 agent 配置文件, 不影响无关内容
- 无状态追踪, 直接读取各 agent 实际配置文件
- 支持 5 个 agent: Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity
- Antigravity 仅支持全局配置, 其余支持项目级配置

## Capabilities

### New Capabilities

- `central-storage`: 中央仓库管理, 包括 setup 初始化, config.json 配置 (GLM5 key, Web Reader key, 端点选择), 服务定义文件的 CRUD
- `server-management`: MCP 服务的添加 (URL/GitHub 简写), 移除, 列出; 通过 GLM5 分析文档自动生成 default + per-agent overrides 配置
- `agent-adapters`: 各 agent 的配置适配器, 包括配置文件的读取, 合并写入, 格式转换 (JSON/TOML), 同名冲突检测
- `project-operations`: 项目级操作, 包括 init (交互式选择 agent 和服务), add/remove (项目中添加或移除服务), sync (同步中央仓库变更到项目), list (跨 agent 状态矩阵)
- `glm-integration`: GLM5 API 调用, Web Reader MCP 工具集成, 文档分析 prompt 管理, function calling 多轮对话处理

### Modified Capabilities

## Impact

- 新建 TypeScript 项目, 使用 tsup 打包, vitest 测试
- 依赖: TOML 解析库 (处理 Codex CLI 配置), HTTP 客户端 (调用 GLM5 和 Web Reader), 交互式 CLI 库 (inquirer 或类似)
- 需要用户提供智谱平台的 API key (GLM5 + Web Reader)
- 文件系统操作: 读写 `~/.mcps-manager/` 和各 agent 项目级配置文件
- 文件权限: `~/.mcps-manager/` 目录 700, 服务定义文件 600
