## 1. rmcp 兼容开关 (xats P1: 正确性)

- [x] 1.1 codex adapter `write()`: http/streamable-http server 写入时, 顶级 `experimental_use_rmcp_client` 不存在则写 `true`, 已存在 (任意值) 不动; stdio 写入不触发; 单测覆盖三种情形 (不存在/已 true/已 false) 与 stdio 不触发

## 2. token 安全化 (xats P2: bearer_token_env_var + 空 headers 省略)

- [x] 2.1 `src/types.ts`: `HttpConfig` 增加可选 `bearerTokenEnvVar?: string`
- [x] 2.2 `manifest-apply.ts`: envVar `appliedAs` 满足 Authorization (大小写不敏感) + `Bearer ${VALUE}` 时, 向所有 HTTP server config 填充 `bearerTokenEnvVar = envVars[].name` (无论值是否提供, 取声明顺序第一个); 明文 header 插入逻辑不变; 单测覆盖有值/无值/非 Bearer 形态三种
- [x] 2.3 codex adapter `toAgentFormat`: 有 `bearerTokenEnvVar` 时写 `bearer_token_env_var`, 不写 `Authorization` header; `http_headers` 为空时整块省略; `fromAgentFormat` 读回 `bearer_token_env_var`; 单测覆盖写入形态 + round-trip
- [x] 2.4 opencode adapter `toAgentFormat`: `headers` 空对象时省略该键; 单测覆盖

## 3. --global flag (xats P3)

- [x] 3.1 `AgentAdapter` 接口增加可选 `globalDir?: () => string`; codex adapter 实现为 home 目录
- [x] 3.2 `add.ts` + `index.ts`: 新增 `--global` option; 校验所选 agent 支持 (`globalDir` 存在且 `isGlobal !== true`), 不支持时报错 exit 1; `writeToAgent` 目标目录切换; central/bundle/manifest 三路径一致生效; 单测覆盖 codex 全局写入 + opencode 报错 + antigravity (isGlobal) 报错

## 4. envVar 非交互来源 (xats P4: --var / process.env)

- [x] 4.1 `index.ts` + `add.ts`: 新增可重复 `--var NAME=VALUE` option (按第一个 `=` 切分); 非 manifest 路径传入报错; NAME 不在 manifest envVars/variables 中报错并列出可用名; 单测覆盖解析与两种报错
- [x] 4.2 `add.ts` envValues 收集: 优先级 `--var` > `process.env[name]` (经 deps 注入) > 交互 prompt; 命中非交互来源时打印来源提示 (secret 不回显); `-y` 下 required 全来源缺值维持现有报错文案, optional 有非交互值则使用; variables 支持 `--var` (专用 flag 如 `--port` 优先, 不读 process.env); 单测覆盖优先级/交互跳过/-y required 通过与 fail-fast/-y optional 吃值
- [x] 4.3 更新 -y required variable 报错文案, 提及 `--var` 补齐方式

## 5. 收尾

- [x] 5.1 全量 `npm test` + `npm run build` (或项目等价命令) 通过; README/--help 文案补 `--global` 与 `--var`
