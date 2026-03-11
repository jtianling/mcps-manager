## Context

多个编程 agent (Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity) 各自使用不同的 MCP 配置格式和文件位置.  开发者在项目中使用多个 agent 时, 需要手动维护多份配置, 格式各异 (JSON/TOML), schema 各异 (key 名, transport type 值, command 格式等).  当前没有统一管理工具.

参考项目 skills-manager 和 rules-manager 的两层存储 + 项目部署模式, 构建 mcpsmgr CLI.

### 各 Agent 配置差异摘要

| Agent | 文件 | 格式 | 顶层 key | env key | command 格式 | 作用域 |
|-------|------|------|----------|---------|-------------|--------|
| Claude Code | .mcp.json | JSON | mcpServers | env | string + args | 项目 |
| Codex CLI | .codex/config.toml | TOML | mcp_servers | env | string + args | 项目 |
| Gemini CLI | .gemini/settings.json | JSON | mcpServers | env | string + args | 项目 |
| OpenCode | opencode.json | JSON | mcp | environment | array (含 cmd) | 项目 |
| Antigravity | ~/.gemini/antigravity/mcp_config.json | JSON | mcpServers | env | string + args | 全局 |

## Goals / Non-Goals

**Goals:**

- 提供统一 CLI 管理 5 个 agent 的 MCP 配置
- 中央仓库 (`~/.mcps-manager/`) 存储服务定义, 含 API key
- 合并写入各 agent 配置文件, 不影响无关内容
- 通过 GLM5 + Web Reader 自动分析 MCP 文档, 生成 per-agent 配置
- 无状态追踪, 直接读取各 agent 实际配置文件
- 支持 URL 和 GitHub `owner/repo` 简写添加服务

**Non-Goals:**

- 不做 profiles (预设服务组合), 后续按需添加
- 不内置 registry 模板, 所有服务通过用户手动或 GLM5 分析添加
- 不支持 `@scope/package` npm 包格式作为添加输入
- 不管理 agent 本身的安装或其他非 MCP 配置

## Decisions

### D1: Adapter 模式处理各 agent 配置差异

每个 agent 实现一个 Adapter, 包含 read / write / toAgentFormat / fromAgentFormat 方法.  Adapter 负责:
- 解析目标配置文件 (JSON 或 TOML)
- 仅修改 MCP 相关部分, 保留其他内容
- 将通用服务定义转换为 agent 特定的 schema

**备选方案**: 统一模板 + 变量替换.  放弃原因: 各 agent 的 schema 差异过大 (key 名, 值格式, transport type 都不同), 模板无法覆盖.

### D2: 中央仓库直接存储 API key (明文)

服务定义文件中直接保存 key 明文.  因为工具完全本地运行, 无网络传输风险.  通过文件权限 (目录 700, 文件 600) 保护.

**备选方案**: 环境变量引用 / keychain 集成.  放弃原因: 增加复杂度, 本地工具无传输隐私问题.

### D3: 合并写入而非 symlink

配置文件多为混合文件 (MCP 只是其中一部分), symlink 会覆盖其他配置.  采用 read-modify-write: 读取目标文件 → 解析 → 修改 MCP 部分 → 序列化回写.

**备选方案**: 仅管理专用文件 (如 .mcp.json).  放弃原因: 实用性太窄, 大部分 agent 的 MCP 配置嵌在混合文件中.

### D4: 通用服务定义格式

```json
{
  "name": "brave-search",
  "source": "https://github.com/anthropics/mcp-brave-search",
  "default": {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@anthropic/mcp-brave-search"],
    "env": { "BRAVE_API_KEY": "sk-xxx" }
  },
  "overrides": {
    "claude-code": {
      "transport": "http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer sk-xxx" }
    }
  }
}
```

有 override 用 override, 没有用 default 经 adapter 格式转换.

### D5: GLM5 Agent 分析文档

添加服务时, 用户提供 URL 或 GitHub owner/repo.  mcpsmgr 调用 GLM5, 将 webReader 作为 function calling tool 提供.  GLM5 自主决定是否调用 webReader 获取文档内容, 分析后返回结构化配置.

GitHub owner/repo 优先拼接 README URL: `https://github.com/{owner}/{repo}/blob/main/README.md`.  README 不存在则给仓库首页, 由 GLM5 自行探索.

### D6: 无状态文件, 读取追踪

不维护项目状态文件.  `list` 命令直接扫描各 agent 的实际配置文件, 解析出已配置的 MCP 服务.  这样:
- 用户手动修改配置后, 状态自动保持最新
- 不存在状态与实际不一致的问题

### D7: 同名冲突报错不修改

中央仓库添加同名服务 → 报错, 提示先 remove.  项目部署时目标文件已有同名服务 → 报告冲突, 不修改该 agent 的配置文件.

## Risks / Trade-offs

- [TOML 序列化保真度] 读取 .codex/config.toml 后重新序列化可能丢失注释和格式 → 使用保留注释的 TOML 库 (如 @iarna/toml 或 smol-toml), 优先保留原始格式
- [GLM5 分析准确性] LLM 可能误判配置 → 展示详细分析结果让用户选择是否信任, 不信任则回退手动模式
- [配置文件并发修改] 用户在 mcpsmgr 操作同时手动编辑配置文件 → 概率极低, 不特别处理
- [Web Reader 调用配额] 智谱 Web Reader MCP 有月度调用限制 (Lite 100 次) → 仅在 server add 时调用, 频率很低
- [Antigravity 未来支持项目级配置] Google 可能后续添加项目级支持 → Adapter 抽象层便于扩展, 届时新增配置路径即可
