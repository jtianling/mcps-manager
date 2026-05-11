## Why

mcpsmgr 当前支持 Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, OpenClaw 共 7 个 agent, 但缺失 NousResearch 的 Hermes Agent. Hermes 是一个开源 (MIT) 编程 agent (Python 实现), 原生支持 MCP, 配置写在 `~/.hermes/config.yaml` (全局, 仅 user-level scope, 不存在项目级). 用户希望把中央仓库的 MCP server 一并部署到 Hermes.

Hermes 跟现有 adapter 有几个显著差异:
- **文件格式是 YAML**, 不是 JSON / JSON5 / TOML
- 顶层字段是 `mcp_servers` (snake_case), 不是 `mcpServers`
- transport 没有显式 `type` 字段, 由是否含 `command` 或 `url` 推断
- `env` 是 mapping, 不是数组; 仅支持 `${VAR}` 大括号引用 (源码 `re.sub(r"\$\{(\w+)\}", _replace, value)`)
- disable 字段是 `enabled: false` (语义反向), 而非 `disabled: true`

## What Changes

- 新增 Hermes 适配器, 操作 `~/.hermes/config.yaml` (全局 YAML)
- stdio 写 `{ command, args, env? }` (native env mapping, 复用 `resolveEnvInArgs` 处理 `${VAR}` 替换), 无 env vars 时省略 env 字段
- HTTP 写 `{ url, headers? }` (无 `type` 字段, headers 为空则省略)
- `fromAgentFormat` 根据 `command` / `url` 推断 transport
- 在 `AgentId` 类型与 manifest 已知 agent 列表中新增 `"hermes"`
- 注册到 `allAdapters`, 自动参与 detect/add/deploy/list/remove 等流程
- README "Supported agents" 表 + global agents 提示语补 Hermes 一行
- 新增 `yaml` 依赖 (`^2.8.4`) 处理 YAML 读写

## Capabilities

### New Capabilities

(无, 新 adapter 通过 agent-adapters spec 表达)

### Modified Capabilities

- `agent-adapters`: ADDED Hermes Adapter requirement; MODIFIED Agent 自动检测 scenario, 把 Hermes 加入"全局可选项"行

## Impact

- 代码: `src/types.ts` (AgentId 联合扩展), `src/adapters/hermes.ts` (新建), `src/adapters/index.ts` (注册), `src/install/manifest-schema.ts` (KNOWN_AGENT_IDS 扩展)
- 测试: `src/adapters/__tests__/hermes.test.ts` (新增, 20 个用例覆盖 stdio/http/conflict/remove/env 替换/格式互转/YAML 写入/嵌套目录创建/保留其它顶层字段)
- 文档: `README.md` (Supported Agents 表 + global agents 提示语)
- 规范: `openspec/specs/agent-adapters/spec.md` (新增 Hermes Adapter requirement)
- 依赖: 新增 `yaml@^2.8.4`
- 用户影响: Hermes 是 global agent, `add` / `deploy` 默认不勾选, 用户主动选择才会写 `~/.hermes/config.yaml`; 旧用户数据无破坏
