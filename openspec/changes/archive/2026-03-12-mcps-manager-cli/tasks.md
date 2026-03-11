## 1. 项目初始化

- [x] 1.1 初始化 npm 项目, 配置 package.json (name: mcpsmgr, bin 入口), tsconfig.json, tsup 打包配置, vitest 测试配置
- [x] 1.2 搭建 src/ 目录结构: commands/, adapters/, services/, utils/, types.ts, index.ts (CLI 入口)
- [x] 1.3 安装依赖: TOML 解析库, HTTP 客户端, 交互式 CLI 库 (inquirer/prompts), CLI 框架 (commander)

## 2. 类型定义与通用服务定义格式

- [x] 2.1 定义 ServerDefinition 类型 (name, source, default, overrides)
- [x] 2.2 定义 DefaultConfig 类型 (transport, command, args, env, url, headers)
- [x] 2.3 定义 AgentAdapter 接口 (read, write, remove, has, toAgentFormat, fromAgentFormat)
- [x] 2.4 定义 GlobalConfig 类型 (glm.apiKey, glm.endpoint, webReader.apiKey, webReader.url)

## 3. 中央仓库管理 (central-storage)

- [x] 3.1 实现 setup 命令: 创建 ~/.mcps-manager/ 和 servers/ 目录, 设置权限 700
- [x] 3.2 实现 setup 交互流程: 收集 GLM5 API Key, 端点选择, 保存 config.json (权限 600). Web Reader API Key 复用 GLM5 API Key
- [x] 3.3 实现 config.json 读写工具函数
- [x] 3.4 实现服务定义文件的读写工具函数 (含权限 600 设置)

## 4. Agent Adapters

- [x] 4.1 实现 Claude Code Adapter: 读写 .mcp.json, mcpServers 格式转换
- [x] 4.2 实现 Codex CLI Adapter: 读写 .codex/config.toml, mcp_servers TOML 格式转换, 保留非 MCP section 和注释
- [x] 4.3 实现 Gemini CLI Adapter: 读写 .gemini/settings.json, mcpServers 格式转换, 保留非 MCP 字段
- [x] 4.4 实现 OpenCode Adapter: 读写 opencode.json, mcp 格式转换 (command 数组, environment key, type local/remote)
- [x] 4.5 实现 Antigravity Adapter: 读写 ~/.gemini/antigravity/mcp_config.json (全局), mcpServers 格式转换 (HTTP 时用 serverUrl)
- [x] 4.6 实现 Agent 自动检测: 扫描项目目录判断哪些 agent 配置文件已存在
- [x] 4.7 编写各 adapter 的单元测试

## 5. GLM5 集成 (glm-integration)

- [x] 5.1 实现 GLM5 API 客户端: Chat Completion 请求封装, Bearer 认证
- [x] 5.2 实现 webReader function calling 工具定义
- [x] 5.3 实现 Web Reader MCP 调用: 向 Web Reader 端点发送请求, 获取网页内容
- [x] 5.4 实现多轮对话处理: 循环处理 tool_calls, 回传结果, 直到获得最终分析
- [x] 5.5 实现分析结果解析: 从 GLM5 响应中提取结构化 JSON (name, default, overrides, requiredEnvVars)
- [x] 5.6 实现 GitHub owner/repo 解析: 判断输入格式, 拼接 GitHub URL, 构造 user message 指示优先读 README
- [x] 5.7 编写 system prompt: 指示 GLM5 分析 MCP 文档, 提取 5 个 agent 的配置差异

## 6. 服务管理命令 (server-management)

- [x] 6.1 实现 server add 命令: 解析输入 (URL / owner/repo / 不合法格式), 调用 GLM5 分析, 展示结果, 用户确认, 收集 env 变量值, 保存到中央仓库
- [x] 6.2 实现 server add 手动模式回退: 无 URL 或用户不信任 GLM5 时的交互式配置
- [x] 6.3 实现 server remove 命令: 从中央仓库删除服务定义文件
- [x] 6.4 实现 server list 命令: 列出中央仓库所有服务

## 7. 项目操作命令 (project-operations)

- [x] 7.1 实现 init 命令: 交互式选择 agent (含自动检测预选) + 选择中央仓库中的服务 + 确认 + 批量写入
- [x] 7.2 实现 add 命令: 从中央仓库取服务定义, 检测项目 agent, 用户勾选, 写入配置 (含同名冲突跳过)
- [x] 7.3 实现 remove 命令: 扫描各 agent 配置中包含该服务的, 用户勾选, 删除条目
- [x] 7.4 实现 sync 命令: 比对中央仓库与项目 agent 配置, 展示变更预览, 确认后更新
- [x] 7.5 实现 list 命令: 扫描各 agent 配置, 生成跨 agent 状态矩阵表格

## 8. CLI 入口与集成

- [x] 8.1 使用 commander 注册所有命令和子命令 (setup, server add/remove/list, init, add, remove, sync, list)
- [x] 8.2 添加 setup 前置检查: 非 setup 命令执行前检测 ~/.mcps-manager/config.json 是否存在
- [x] 8.3 端到端测试: 完整流程测试 (setup → server add → init → add → list → sync → remove)
