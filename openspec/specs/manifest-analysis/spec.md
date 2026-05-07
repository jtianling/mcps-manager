# manifest-analysis Specification

## Purpose
TBD - created by archiving change manifest-add-from-github. Update Purpose after archive.
## Requirements
### Requirement: mcpsmgr.json manifest 文件位置

系统 SHALL 把 `mcpsmgr.json` 视为仓库根目录的 manifest 文件名.  仓库提供该文件意味着仓库作者声明了此仓库支持 manifest-driven add flow.

#### Scenario: manifest 文件位置约定

- **WHEN** mcpsmgr 需要拉取仓库的 manifest
- **THEN** 系统 SHALL 拉取 `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/mcpsmgr.json`, 不尝试其他文件名 (`mcpsmgr.config.json`, `.mcpsmgr/manifest.json` 等)

### Requirement: manifest schema 必需字段

系统 SHALL 在 manifest 校验阶段拒绝缺少必需字段的 manifest.

#### Scenario: 缺少 schemaVersion

- **WHEN** manifest 不含 `schemaVersion` 字段
- **THEN** 系统 SHALL 报错 "manifest missing required field: schemaVersion", 退出码非零

#### Scenario: 缺少 name

- **WHEN** manifest 不含 `name` 字段
- **THEN** 系统 SHALL 报错 "manifest missing required field: name", 退出码非零

#### Scenario: 缺少 agents

- **WHEN** manifest 不含 `agents` 字段或 `agents` 为空对象
- **THEN** 系统 SHALL 报错 "manifest must declare at least one agent under 'agents'", 退出码非零

### Requirement: schemaVersion 兼容范围

系统 SHALL 仅接受 `schemaVersion` 以 `1.` 开头的 manifest, 拒绝其他主版本.

#### Scenario: 1.x 接受

- **WHEN** manifest `schemaVersion = "1.0.0"` 或 `"1.2.0"`
- **THEN** 系统 SHALL 接受, 继续后续校验

#### Scenario: 2.x 拒绝

- **WHEN** manifest `schemaVersion = "2.0.0"`
- **THEN** 系统 SHALL 报错提示 mcpsmgr 只支持 1.x manifest, 引导用户升级 mcpsmgr

### Requirement: agents 节点 key 校验

系统 SHALL 校验 `agents` 字段下的 key 是已知 AgentId 的子集 (`claude-code | codex | cursor | gemini-cli | opencode | antigravity | openclaw`).

#### Scenario: 未知 agent id

- **WHEN** `agents` 节点下出现 `"foo": {...}`, 而 `foo` 不在已知 AgentId 列表
- **THEN** 系统 SHALL 报错 "unknown agent id 'foo' in manifest.agents; known: ...", 退出码非零

### Requirement: server transport 校验

系统 SHALL 校验 `agents.<id>.servers[].config.transport` 在 `stdio | http | streamable-http | sse` 内.

#### Scenario: transport 错误

- **WHEN** server config `transport = "websocket"`
- **THEN** 系统 SHALL 报错 "unsupported transport 'websocket' in agents.codex.servers[0]; expected stdio | http | streamable-http | sse"

### Requirement: envVars.appliedAs.format 必须含 ${VALUE}

系统 SHALL 校验每个 `envVars[]` 项的 `appliedAs.format` 字段必须包含 `${VALUE}` token.

#### Scenario: 缺 ${VALUE}

- **WHEN** envVar `appliedAs.format = "Bearer"` (没有 `${VALUE}`)
- **THEN** 系统 SHALL 报错 "envVar '<name>'.appliedAs.format must contain ${VALUE} placeholder"

### Requirement: 变量替换语义

系统 SHALL 在 manifest apply 阶段对 `agents.*.servers[].config`, `prerequisites[].command`, `prerequisites[].notes[]`, `agents.*.postInstallNotes[]` 的字符串字段执行变量替换.

#### Scenario: variables 引用

- **WHEN** manifest `variables.port.default = "9100"`, server config `url = "http://127.0.0.1:${port}/mcp"`, 用户未通过 `--port` 覆盖
- **THEN** 系统 SHALL 把 `url` 实际写出为 `http://127.0.0.1:9100/mcp`

#### Scenario: variables 用户覆盖

- **WHEN** manifest `variables.port.default = "9100"`, 用户传 `--port 9200`
- **THEN** 系统 SHALL 把所有 `${port}` 引用替换为 `9200`

#### Scenario: envVar 跨字段引用

- **WHEN** manifest 有 `envVars[].name = "FOO_TOKEN"`, server config 中 `headers.X-Foo = "${FOO_TOKEN}"`
- **THEN** 系统 SHALL 把 `${FOO_TOKEN}` 替换为该 envVar 的实际值 (用户 prompt 后)

#### Scenario: appliedAs.format 自引用 ${VALUE}

- **WHEN** manifest envVar `appliedAs.format = "Bearer ${VALUE}"`, 用户输入值 `abc123`
- **THEN** 系统 SHALL 把序列化后的 header 值写为 `"Bearer abc123"`

#### Scenario: 未定义变量

- **WHEN** server config 中出现 `${unknownVar}`, 而 manifest 既无 `variables.unknownVar` 也无 `envVars[].name = "unknownVar"`
- **THEN** 系统 SHALL 报错 "unresolved variable reference '${unknownVar}' in agents.<id>.servers[<i>].config.<field>"

### Requirement: manifest fetch 策略

系统 SHALL 用 `fetch` 拉 GitHub raw URL 获取 manifest, 不引入 gh CLI 降级.

#### Scenario: 200 OK

- **WHEN** raw URL 返回 200 且 body 是合法 JSON
- **THEN** 系统 SHALL 把 body parse 为 manifest, 进入校验阶段

#### Scenario: 404 not found

- **WHEN** raw URL 返回 404
- **THEN** 系统 SHALL 返回 `undefined` (不抛错), 由调用方决定回退到 readme-analysis

#### Scenario: 非 404 错误

- **WHEN** raw URL 返回 5xx 或网络错误
- **THEN** 系统 SHALL 抛错, 不静默回退

#### Scenario: 200 但 body 非 JSON

- **WHEN** raw URL 返回 200 但 body 不是合法 JSON
- **THEN** 系统 SHALL 抛错 "mcpsmgr.json from {owner}/{repo} is not valid JSON", 不回退

### Requirement: prerequisites 只 print 不 exec

系统 SHALL 把 manifest `prerequisites` 视为信息性提示, NEVER 自动执行其中的 command.

#### Scenario: 打印 prerequisites

- **WHEN** add flow 完成 server 写盘之后, manifest 含 prerequisites
- **THEN** 系统 SHALL 把每个 prerequisite 的 description, 替换变量后的 command, notes 列表打印到 stdout, 不调用 child_process

### Requirement: compatibility.npmPackage range 校验

系统 SHALL 在 manifest apply 阶段, 当 manifest 含 `compatibility.npmPackage` 时, 校验各 agent server `args` 中出现的同 npm 包引用 range 是否一致.

#### Scenario: range 一致

- **WHEN** `compatibility.npmPackage = "foo@^0.5"`, args 含 `"foo@^0.5"` 或 `"-p foo@^0.5"` 等价引用
- **THEN** 系统 SHALL 校验通过, 不输出额外信息

#### Scenario: range 不一致

- **WHEN** `compatibility.npmPackage = "foo@^0.5"`, args 含 `"foo@latest"` 或 `"foo@^0.4"`
- **THEN** 系统 SHALL 输出 warning, 但不阻断流程

