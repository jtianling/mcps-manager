## Why

当前 `mcpsmgr install <url|owner/repo>` 依赖 GLM5 大模型 + 智谱 Web Reader MCP 分析 README 并生成服务配置. 这条路径有三个已知问题:

1. **依赖外部密钥和计费服务.** `setup` 必须填 GLM API key, 每次 install / update 都打外部 API, 失败模式不可预测 (prompt 漂移, JSON 解析失败, 网络错误).
2. **LLM 生成的 `overrides` 字段是冗余的.** 每个 adapter 的 `toAgentFormat` 已经负责把 `DefaultConfig` 翻译成 agent 专属格式 (opencode 的 command 数组, antigravity 的 serverUrl 等). LLM 再生成一份 `overrides` 是重复劳动, 而且经常出错.
3. **主流 MCP server README 有强格式约定**, 规则化分析完全够用: 要么有 `claude mcp add <name> <cmd> <args...>` CLI 行, 要么有 `mcpServers` JSON block, 两者覆盖 90%+ 的场景.

替换成确定性规则后, 失败会明着失败 (降级到 manual 向导), 不会像 LLM 那样返回一个看起来像但实际错位的配置.

## What Changes

- **BREAKING** 移除所有 LLM / Web Reader 集成, 包括 `src/services/glm-client.ts`, `src/services/system-prompt.ts`, `src/services/web-reader.ts`, `GlobalConfig.glm`, `GlobalConfig.webReader`.
- **BREAKING** 删除 `mcpsmgr setup` 命令 (不再需要 GLM API key 初始化).
- 新增 `src/install/` 目录, 承载规则化分析: `source.ts` (输入归一化), `github-readme.ts` (README 拉取 fetch 优先 + gh 降级), `readme-parser.ts` (P1 `claude mcp add` 行 + P2 `mcpServers` JSON block 的分层抽取策略), `manifest.ts` (package.json / pyproject.toml 兜底), `local-json.ts` (本地 JSON 多形状嗅探, 复用 adapter 的 `fromAgentFormat`), `analyze.ts` (统一入口).
- `mcpsmgr install` 支持四种输入形态: `owner/repo`, `https://github.com/owner/repo[/...]`, `./path.json` (多形状嗅探), `./path/dir` (manifest 探测). `install <URL>` 只接受 GitHub URL.
- `mcpsmgr install` 解析到多 server 的本地 JSON 时 (例如 claude-code 的 `mcpServers` 含多个条目), 交互式选择 (多选).
- 规则化分析产出维持 `AnalysisResult` 同形状, 但 `overrides` 字段不再由分析流程写入; 只有用户手写 JSON 导入时才会保留 overrides.
- `mcpsmgr update` 改为跑规则化分析再刷新配置, 不再有 LLM 调用.
- `mcpsmgr install` 的 `claude mcp add` 行扫描**只在 fenced code block 内**, 不扫裸文, 减少误报.

## Capabilities

### New Capabilities

- `readme-analysis`: 规则化的 MCP server 文档分析, 从 GitHub README 抽取 server 配置, 多层兜底降级到 manual.
- `local-source-analysis`: 本地路径 (目录 / JSON 文件) 的配置探测与多形状嗅探.

### Modified Capabilities

- `server-management`: `install` 流程从 LLM 分析改为规则化分析; 删除同名服务检测涉及 GLM 的语句; 增加本地 JSON / 目录的 install 形态.
- `glm-integration`: 整条 capability 移除 (换成 `readme-analysis` 和 `local-source-analysis`).

## Impact

- **代码**: 删除 `src/services/` 整个目录; 新增 `src/install/`; `src/commands/install.ts`, `src/commands/update.ts`, `src/commands/setup.ts`, `src/index.ts`, `src/types.ts`, `src/utils/config.ts` 需要改动.
- **依赖**: `package.json` 不需要新增依赖 (fetch 是内置, gh CLI 可选降级).
- **配置**: `~/.mcps-manager/config.json` 不再需要 `glm` 和 `webReader` 段. 已有用户升级后这两段会被忽略 (不会报错, 但会被 config 加载路径删除).
- **测试**: `src/__tests__/integration.test.ts` 里 mock GLM 的部分需要改为 mock fetch / mock gh. 新增针对 `src/install/` 各模块的单测.
- **文档**: README.md / docs/README_zh-CN.md 需要更新 — 删除 GLM 相关段落, 改写 install 流程描述.
- **openspec**: `openspec/specs/glm-integration/` 在 sync 后从 main specs 移除. 新增 `openspec/specs/readme-analysis/` 和 `openspec/specs/local-source-analysis/`.
