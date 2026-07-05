## Context

`mcpsmgr add` 的 manifest-driven 路径 (`runAddFromManifest`) 目前把 envVar 的值交互式收集后, 经 `applyManifest` 的 `buildEnvHeaderInsertions` 解析为明文 header, 各 adapter 只见到已解析的 `DefaultConfig` (env var 名字在 adapter 层已丢失)。codex adapter 只写项目级 `<projectDir>/.codex/config.toml`, 对 http server 恒写 `http_headers` 表 (可为空)。

xats 实测暴露的 4 个问题 (优先级 2>3>1>4, 编号沿用 xats 侧正式请求):

1. codex `--remote`/app-server 模式 MCP 由 CODEX_HOME 全局配置加载, 项目级配置不生效 → 需要 `--global`。
2. 缺顶级 `experimental_use_rmcp_client = true` 时旧版 codex 不加载 streamable-http MCP (codex PR #8087, 2025-12-20 起该 flag 移除且 rmcp 为默认; 新版容忍残留键, codex-cli 0.142.3 实证)。
3. 明文 token 落盘 + 空 `http_headers` 表在 tokened daemon 下必 401 (mac mini 实测)。codex 官方支持 `bearer_token_env_var` (见 codex-rs/config/src/mcp_types.rs), 且拒绝明文 `bearer_token`。
4. env var 值无非交互来源, code agent 无 TTY 跑不通; `-y` 无条件跳过 optional token。

跨仓库契约: `bearer_token_env_var` 写入的名字取自 manifest `envVars[].name`; xats 侧将把 manifest 里的 `CROSS_AGENT_TEAMS_TOKEN` 改名为 `CROSS_AGENT_TEAMS_MCP_TOKEN` 对齐其设备级 zshrc export, 本仓库不关心具体名字。

## Goals / Non-Goals

**Goals:**

- 写出的 codex 配置对新旧版 codex 都开箱可用 (rmcp 开关兼容写入)。
- token 不再以明文进入可能被签入仓库的项目文件 (codex 路径)。
- token 缺失时不写出必然 401 的空 headers 结构。
- `mcpsmgr add ... -a codex --global` 一条命令让 `--remote`/app-server 场景就绪。
- `--var NAME=VALUE` / `process.env` 让无 TTY 的 code agent 全自动完成 add。

**Non-Goals:**

- 不改 opencode 有 token 时的明文写法 (opencode 无 env 引用机制)。
- 不为 codex 以外的 adapter 实现全局写入。
- 不动 xats 仓库的 manifest (envVar 改名由对方负责)。
- 不做 token 生成/持久化 (xats 侧 start-xats 负责)。

## Decisions

### D1: rmcp 开关在 codex adapter `write()` 内联保证

codex adapter 写 http/streamable-http server 时, 若 parsed config 顶级无 `experimental_use_rmcp_client`, 则一并写入 `true`; 已存在 (无论值) 则不动。放在 adapter 而非 add 命令层, 因为该键属于 codex 配置文件的内部约定, 且 update/deploy 等其他写路径也自动受益。stdio server 不触发 (rmcp 开关只影响 http 类加载)。

### D2: `bearerTokenEnvVar` 作为 `HttpConfig` 可选字段贯通 manifest → adapter

`buildEnvHeaderInsertions` 阶段 env var 名字尚在, adapter 层已丢失, 故在 `HttpConfig` 上加可选 `bearerTokenEnvVar?: string`, 由 `applyManifest` 在 envVar 满足 `appliedAs = {kind:"header", name:"Authorization"(大小写不敏感), format:"Bearer ${VALUE}"}` 时填充为 `envVars[].name` — **无论用户是否提供了值** (值缺失时明文 header 插入不发生, 但 env var 引用仍应写出, codex 运行时从环境取)。

- codex adapter `toAgentFormat`: 有 `bearerTokenEnvVar` → 写 `bearer_token_env_var = "<name>"`, 且不写 `Authorization` 明文 header (即使值存在); 其余 headers 照旧。
- 其他 adapter 忽略该字段, 行为不变 (仍消费已解析的明文 header)。
- 中央仓库 server definition 存储 `DefaultConfig`, 新字段随 JSON 自然持久化, 旧记录无此字段等价于旧行为。
- `fromAgentFormat` 读回 `bearer_token_env_var` → `bearerTokenEnvVar` (round-trip, 供 read/has/update 路径)。

替代方案: 新增 `appliedAs.kind = "bearer-token-env"` manifest 语义 — 被否, 需要 manifest schema 升版并强迫所有 server 作者理解 codex 特有概念; 从现有 Authorization Bearer 模式自动识别零成本且向后兼容。

### D3: 空 headers 结构整块省略

- codex `toAgentFormat`: `http_headers` 无内容时省略该表。
- opencode `toAgentFormat`: `headers` 为空对象时省略该键。
读方向两个 adapter 本就把缺失 headers 处理为 `?? {}`, 无兼容问题。

### D4: `--global` 为 add 命令 flag, adapter 声明 `globalDir`

`AgentAdapter` 增加可选 `globalDir?: () => string` (codex 返回 `os.homedir()`)。`--global` 时 add 将写入目录从 `projectDir` 换成 `adapter.globalDir()` — 复用现有 `write(dir, ...)` 签名 (codex 的全局布局恰为 `<home>/.codex/config.toml`, 与 `configPath(dir)` 拼法一致)。校验: 所选 agent 无 `globalDir` 或 `isGlobal === true` 时报错 exit 1; `--global` 对 central/bundle/manifest 三条 add 路径一致生效 (仅影响 `writeToAgent` 的目标目录)。

替代方案: codex adapter 默认写全局 — 被否, 破坏现有项目级行为且不可逆; flag 是最小变更。

### D5: envVar 值三级来源, 汇聚在 add 命令层

`runAddFromManifest` 收集 envValues 时按 `--var NAME=VALUE` (可重复, 解析为 map) > `process.env[name]` > 交互 prompt 取值:

- 命中 `--var` 或 `process.env`: 不 prompt (交互与 `-y` 模式一致), 打印一行来源提示 (不回显 secret 值)。
- 都未命中: 交互模式照旧 prompt; `-y` 模式下 required 报错 (文案维持 "Set it in the environment before running, or omit -y", 自此为事实), optional 跳过。
- `--var` 的 NAME 不属于 manifest `envVars[].name` 或 `variables` 时报错 exit 1 (fail fast, 防拼写错误静默失效)。
- `--var` 同时可为 `variables` 提供值 (与 `--port` 并存, `--port` 优先级更高, 维持既有语义)。
- 非 manifest 路径 (central/bundle) 传 `--var` 报错, 与 `--port` 同类校验。

process.env 读取位于 production deps 层 (`productionAddDeps`), 测试通过注入覆盖, 不直接在纯函数里碰全局状态。

## Risks / Trade-offs

- [codex 对未设置的 `bearer_token_env_var` 引用的行为未实证 (env var 不存在时可能报错或跳过认证)] → xats 约定 token 恒由 zshrc export, 正常路径不会出现; postInstallNotes 层面的提示由 xats manifest 负责。
- [旧版 codex 视角: `bearer_token_env_var` 是否存在于极旧版本未逐版核实] → 该键在 codex-rs 主线存在已久且被官方文档收录; 且 xats 场景本就要求较新 codex (app-server)。
- [`--global` 写 `~/.codex/config.toml` 会影响用户全部项目] → 仅在显式传 flag 时发生; 同名冲突仍走既有 Conflict 报错, 不覆盖。
- [`process.env` 自动吸值可能让用户在不知情下把环境里的同名变量写进配置] → 值不落盘 (codex 路径只写名字); opencode 等明文路径会落盘, 但打印来源提示行, 用户可见。

## Migration Plan

纯新增行为 + flag, 无需迁移。既有配置文件读回兼容 (明文 header 与 `bearer_token_env_var` 双支持)。回滚 = revert 提交。

## Open Questions

(无 — xats 侧已确认名字以本仓库实现约定为准, 设计定稿后同步对方即可)
