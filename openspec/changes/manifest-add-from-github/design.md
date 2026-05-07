## Manifest schema (v1.0.0)

`mcpsmgr.json` lives at repo root. Schema version 1.0.0.

```jsonc
{
  "$schema": "https://github.com/jtianling/mcps-manager/raw/HEAD/schemas/mcpsmgr.schema.json",
  "schemaVersion": "1.0.0",
  "name": "<server-bundle-name>",
  "displayName": "<human readable>",
  "description": "<one-line>",

  "compatibility": {
    "npmPackage": "<pkg>@<semver-range>"  // optional, used when args 引用同 npm 包
  },

  "variables": {
    "<varName>": {
      "default": "<string>",
      "prompt": "<prompt text>",
      "required": <boolean>
    }
  },

  "envVars": [
    {
      "name": "<UPPER_SNAKE>",
      "required": <boolean>,
      "secret": <boolean>,
      "description": "<...>",
      "appliedAs": {
        "kind": "header",
        "name": "Authorization",
        "format": "Bearer ${VALUE}"
      }
    }
  ],

  "prerequisites": [
    {
      "kind": "long-running-command" | "command",
      "description": "<...>",
      "command": "<shell command, may use ${variables} and ${ENV_VARS}>",
      "notes": ["<extra info to print>"]
    }
  ],

  "agents": {
    "claude-code" | "codex" | "opencode" | "cursor" | "gemini-cli" | "antigravity": {
      "servers": [
        {
          "name": "<mcp server key>",
          "config": {
            "transport": "stdio" | "http" | "streamable-http" | "sse",
            "command": "<...>", "args": [...], "env": {...},     // stdio fields
            "url": "<...>", "headers": {...}                      // http variants fields
          }
        }
      ],
      "postInstallNotes": ["<extra info to print after install>"]
    }
  }
}
```

### Variable substitution semantics

Two distinct substitution scopes, intentionally different:

1. **Cross-field**: `${name}` 引用 `variables.<name>.default` 或 `envVars[].name`. 出现在 `agents.*.servers[].config.*`, `prerequisites[].command`, `prerequisites[].notes[]`, `agents.*.postInstallNotes[]`.
2. **Self-reference inside `envVars[].appliedAs.format`**: `${VALUE}` 是 envVar 自身值的占位 (例如 `"Bearer ${VALUE}"`). 不能跨 envVar 引用.

设计原因: `appliedAs.format` 只描述"如何把这一个值组装成 header / arg", 不需要看其他字段; 把它写成 `${VALUE}` 让 mcpsmgr 实现简单 (替换一次而非通用模板引擎).

### Pinning

- `compatibility.npmPackage` (e.g. `cross-agent-teams-mcp@^0.5`): manifest 作者承诺该 range 内不出 stdio shim breaking. mcpsmgr install 时校验 manifest 内 `args` 中出现的 `<same package>@<...>` 引用与 range 一致 (差异给 warning, 不阻断)
- 不 pin 具体 npm version 给 manifest 作者足够空间; 同时给用户 warning 让 ta 知道 manifest 与运行时版本可能漂移

## Data model: bundle 还是单 server?

**决策: 单 server 写盘, 不引入 bundle 抽象**.

理由 (YAGNI, 三次重复再抽象):
- xats 是首个多 server 案例, 此外没有第二个; 提前抽象 bundle 概念会污染中央仓库 schema
- manifest 流程把每个 server 单独写入 `~/.mcps-manager/servers/<name>.json`, 与现有 `ServerDefinition` 完全兼容; deploy / list / remove 命令零修改
- 唯一代价: `mcpsmgr remove cross-agent-teams` 不会自动连带删除 `cross-agent-teams-channel`. 用户需手动 `remove cross-agent-teams cross-agent-teams-channel`. 接受这个代价, 等真出现第二个多 server 案例再考虑 bundle.
- 后续可向 `ServerDefinition` 添加 optional `bundle?: string` 字段做软引用, 不影响现有逻辑; 留作 future change.

## Fetch 策略

- `mcpsmgr add <github-source>` 命中 GitHub source 时:
  1. 先 GET `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/mcpsmgr.json`
  2. 200 → 走 manifest flow
  3. 404 → 回退到现有 readme-analysis 单 server flow (但落地动作改为 install + 部署到当前项目, 即 add-from-github 的语义化合)
  4. 其他错误 → 抛出, 引导用户检查网络
- 不做 `gh CLI fallback` (manifest 是新东西, 老仓库不会有 `mcpsmgr.json`, 没必要为它走 gh API). README 的 gh fallback 留给 readme-analysis 路径

## CLI 接口

```
mcpsmgr add <input> [-a|--agent <agent-id>] [--port <override>]
```

- `<input>`:
  - `<server-name>` (kebab-case, 不含 `/` 不含 `://`): 走现有 central → project flow
  - `<owner>/<repo>` 或 `https://github.com/...`: 走 manifest flow (manifest 命中) 或 readme flow (manifest 未命中)
- `-a / --agent`: 跳过交互式 agent 选择, 直接对指定 agent 写入. 必须是 manifest `agents` 中存在的 agent id
- `--port` (可选): 覆盖 manifest `variables.port.default`. 仅当 manifest 含 `variables.port` 时有效

行为:
- manifest flow 不带 `-a` → 列出 manifest 中所有 agent (intersect mcpsmgr 内置 adapter), checkbox 多选, 已检测到的 agent 默认勾选
- 带 `-a claude-code` 但 manifest 中没有 `claude-code` 节点 → 报错列出 manifest 实际支持的 agent
- 写盘时:
  - 中央仓库 `~/.mcps-manager/servers/<server-name>.json` 写入每个 server
  - 项目内目标 agent 配置文件写入 (复用现有 adapter.write)
  - 打印 prerequisites + postInstallNotes (按选中 agent 过滤)

## 兼容旧 `add`

输入分类逻辑 (新, 在 `src/commands/add.ts` 入口):

```ts
classifyAddInput(input: string):
  | { kind: "central", name: string }
  | { kind: "github", source: string }
```

- contains `://` 且 host 是 `github.com` → github
- 匹配 `^[a-z0-9._-]+/[a-z0-9._-]+$` → github (owner/repo)
- 仅含 kebab-case 字符 (`^[a-z][a-z0-9-]*$`) → central
- 其他 → error

复用 `src/install/source.ts:isGitHubRepo` / `parseGitHubSource` 现有正则, 避免双份分类规则.

## Validation

manifest schema 校验用手写 validator (`manifest-schema.ts` 内 `validateManifest`):
- 检查必需字段: `schemaVersion`, `name`, `agents`
- 校验 `schemaVersion` 必须以 `1.` 开头 (1.x 兼容)
- 校验 `agents` keys 是已知 AgentId 的子集
- 校验 `transport` 在 `stdio | http | streamable-http | sse` 内
- 校验 `appliedAs.format` 必须含 `${VALUE}` token

不引入 ajv 等运行时依赖. 后续 schema 复杂可考虑.

## 错误处理

- manifest 拉取 404: 不报错, 静默回退到 readme flow (打印一行 info "no mcpsmgr.json, falling back to README analysis")
- manifest JSON parse 错误: 报错, 退出, 不回退 (作者写错了 manifest, 不应该静默掩盖)
- manifest schema 校验失败: 报错, 列出违规字段, 退出
- 变量替换缺失 (`${unknownVar}`): 报错, 列出未定义变量名, 退出
- compatibility.npmPackage 与 args 中 npm 包 range 不一致: warning, 不阻断
- 写盘冲突 (中央仓库已有同名 server): 询问 overwrite, 与现有 install 一致

## 测试策略

TDD RED → GREEN. Unit tests 覆盖:
- manifest-schema: 必需字段 / 未知 agent / 错误 transport / appliedAs.format 缺 `${VALUE}`
- manifest-fetch: 拉 raw 200 / 404 / 网络错误
- manifest-apply: 变量替换 (variables / envVars / 跨字段 / 自引用), env vars header 序列化, prerequisites 替换
- add command: 输入分类 / `-a` flag / manifest 未命中回退 / 多 server 写盘

E2E (端到端):
- 拉 xats `feat/mcpsmgr-manifest` branch 的 `mcpsmgr.json`
- 在临时项目目录跑 `mcpsmgr add jtianling/cross-agent-teams-mcp -a claude-code`
- 断言 `.mcp.json` 出现两个 entries (cross-agent-teams + cross-agent-teams-channel), 内容与 manifest expected 等价
- 断言 `~/.mcps-manager/servers/cross-agent-teams.json` 与 `cross-agent-teams-channel.json` 落盘
- 断言 stdout 含 prerequisites 与 postInstallNotes

## Non-goals

- 不实现 bundle 删除聚合 (单服务级删除即可, 见上)
- 不替用户启动 daemon / 后台进程
- 不做 manifest 自动 update (existing `mcpsmgr update` 可后续扩展)
- 不引入 ajv 或新依赖
