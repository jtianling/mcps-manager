## Purpose

集成 GLM5 大模型和智谱 Web Reader MCP, 实现 MCP 服务文档的自动分析和配置提取.

## Requirements

### Requirement: GLM5 API 调用

系统 SHALL 调用 GLM5 Chat Completion API 分析 MCP 服务文档.

#### Scenario: 调用 GLM5 分析文档

- **WHEN** 用户通过 `mcpsmgr server add <url>` 添加服务
- **THEN** 系统构造请求: model 为 `glm-5`, system prompt 指示分析 MCP 文档并提取 5 个 agent 的配置, tools 中包含 webReader 函数定义, user message 包含用户提供的 URL, 发送到 config.json 中配置的 GLM5 端点

#### Scenario: GLM5 端点认证

- **WHEN** 调用 GLM5 API
- **THEN** 系统使用 `Authorization: Bearer <glm.apiKey>` 认证, Content-Type 为 `application/json`

### Requirement: Web Reader 工具集成

系统 SHALL 将智谱 Web Reader MCP 作为 GLM5 的 function calling tool 提供.

#### Scenario: 定义 webReader 工具

- **WHEN** 构造 GLM5 请求
- **THEN** tools 数组中包含 webReader 函数定义, 参数为 `url` (string, required), tool_choice 设为 `auto`

#### Scenario: 处理 GLM5 的工具调用

- **WHEN** GLM5 返回 `tool_calls` 要求调用 webReader
- **THEN** 系统提取 URL 参数, 向 Web Reader MCP 端点发送请求 (使用 `webReader.apiKey` 认证), 获取网页内容, 将结果作为 `role: "tool"` 消息回传给 GLM5 继续对话

#### Scenario: Web Reader 调用失败

- **WHEN** Web Reader MCP 返回错误或超时
- **THEN** 系统将错误信息回传给 GLM5, 由 GLM5 决定是否重试或基于已有信息返回结果

### Requirement: GitHub README 优先获取

系统 SHALL 对 GitHub `owner/repo` 格式优先获取 README.

#### Scenario: GitHub 简写解析

- **WHEN** 用户输入格式为 `owner/repo` (不含 `/` 以外的特殊字符, 不以 `http` 开头, 不以 `@` 开头)
- **THEN** 系统先尝试给 GLM5 的 user message 中提供 `https://github.com/{owner}/{repo}` 作为文档 URL, 并指示 GLM5 优先读取该仓库的 README

### Requirement: 分析结果结构化输出

GLM5 MUST 返回结构化 JSON 格式的分析结果.

#### Scenario: 标准分析结果

- **WHEN** GLM5 完成文档分析
- **THEN** 返回 JSON 包含: `name` (服务名, 从文档中提取), `default` (基础配置, 含 transport/command/args/env 等), `overrides` (per-agent 配置覆盖, key 为 agent id), `requiredEnvVars` (需要用户提供值的环境变量名列表)

#### Scenario: 分析结果展示

- **WHEN** GLM5 返回分析结果
- **THEN** 系统展示: 服务名, 来源 URL, 基础配置详情, 各 agent 的专属配置差异表 (含 transport 和差异说明), 让用户充分了解后选择是否信任

### Requirement: 多轮对话处理

系统 SHALL 支持 GLM5 function calling 的多轮对话.

#### Scenario: 多次工具调用

- **WHEN** GLM5 在一次对话中多次请求调用 webReader (如先读 README 再读其他页面)
- **THEN** 系统依次执行每次工具调用, 将结果回传, 直到 GLM5 返回最终分析结果 (不含 tool_calls)
