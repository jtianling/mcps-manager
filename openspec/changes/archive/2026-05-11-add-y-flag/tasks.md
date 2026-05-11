## 1. AddOptions 扩展

- [x] 1.1 修改 `src/commands/add.ts`: `AddOptions` 增加 `yes?: boolean` 与 `force?: boolean`
- [x] 1.2 `runAdd` 入口处, `options.yes === true` 时 imply `options.force = true`

## 2. force 跳过覆盖确认

- [x] 2.1 `runAddFromManifest` 中遇到 `serverExists(def.name)` 时, `options.force` 为 true 直接放行, 否则走原 `confirmOverwrite`
- [x] 2.2 不改变 bundle members 收集逻辑 (force 跳过后仍走 writeServerDefinition + writeToAgent)

## 3. -y 自动选 agent

- [x] 3.1 `runAddFromCentral` / `runAddFromBundle`: 无 `--agent` + `yes` 时, 选 detected agents; detected 为空 SHALL 报错并 setExitCode(1)
- [x] 3.2 `runAddFromManifest`: 无 `--agent` + `yes` 时, 选 declared ∩ detected; 交集为空 SHALL 报错并列出 manifest declared list

## 4. -y 必需变量 / env fail-fast

- [x] 4.1 `runAddFromManifest`: required `variable` 在 `variableValues` 缺值且 `yes` 时, 报错指引用户用对应 flag (例: --port for 'port'), setExitCode(1) 返回
- [x] 4.2 `runAddFromManifest`: required `envVar` 在 `yes` 时, 报错指引用户在环境中设置或不带 -y, setExitCode(1) 返回
- [x] 4.3 `runAddFromManifest`: optional `envVar` 在 `yes` 时 SHALL NOT 弹 prompt

## 5. CLI 注册

- [x] 5.1 `src/index.ts` 的 `add` 命令注册 `-y` (无长形, help 文案明确 imply --force 与自动选 agent)
- [x] 5.2 注册 `-f, --force` (窄义, help 文案明确只跳过覆盖确认)
- [x] 5.3 action 回调把 `options.y` 映射到 `addCommand(input, { yes })`

## 6. 测试

- [x] 6.1 `src/commands/__tests__/add.test.ts` 新增 `-y skips confirmOverwrite` 用例
- [x] 6.2 新增 `-f (narrow force) skips confirmOverwrite` 用例
- [x] 6.3 新增 `-y with no --agent auto-selects intersection of declared+detected` 用例
- [x] 6.4 新增 `-y with no detected agents matching manifest errors out` 用例
- [x] 6.5 新增 `-y errors when required variable has no value` 用例
- [x] 6.6 新增 `-y errors when required env var is unset` 用例
- [x] 6.7 新增 `-y skips optional env var prompt entirely` 用例

## 7. 文档

- [x] 7.1 README 表格补 -a / -y / -f 三行
