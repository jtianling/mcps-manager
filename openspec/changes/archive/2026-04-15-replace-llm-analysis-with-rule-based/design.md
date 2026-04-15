## Context

当前架构中 `install <url|owner/repo>` 走这条路径:

```
Source (URL / owner/repo)
    │
    ▼
buildUserMessage() → 构造 user message
    │
    ▼
analyzeWithGlm() → 多轮调用 GLM5 + webReader tool
    │
    ▼
AnalysisResult { name, default, overrides, requiredEnvVars }
    │
    ▼
ServerDefinition → writeServerDefinition
    │
    ▼
(后续) adapter.toAgentFormat → 写各 agent 的配置文件
```

`~/.mcps-manager/config.json` 存 `glm.apiKey`, `glm.endpoint`, `webReader.apiKey`, `webReader.url`. `setup` 命令负责初始化这些.

已观察到的问题:

1. adapter 层的 `toAgentFormat` 已经完整负责 per-agent 格式翻译 (Claude Code 的 `{type, command, args}`, OpenCode 的 `{type, command: [...array]}`, Antigravity 的 `serverUrl` 等), LLM 生成的 `overrides` 要么是空, 要么是错位的冗余.
2. LLM 返回非预期 JSON 时 `parseAnalysisResult` 会抛错, 用户必须 fallback 到 manual 或放弃.
3. setup 把 GLM key 强制变成装机第一步, 用户想用本地路径安装 server 也得先填 key.

规则化替代方案的**可行性依据**:

- 基于 3 个真实 README 的观察:
  - `glips/figma-context-mcp` README 有标准 `{"mcpServers": {...}}` JSON block
  - `ahujasid/blender-mcp` README 有 `claude mcp add blender uvx blender-mcp` CLI 行
  - 本地 `claude-code.mcp.json` 文件直接是 `{"mcpServers": {...}}` 格式
- MCP 社区约定将配置写成 Claude Desktop JSON / `claude mcp add` CLI 命令, 两者都是可确定性解析的.

## Goals / Non-Goals

**Goals:**

1. 彻底移除 GLM / Web Reader 依赖: `src/services/` 目录删除, `GlobalConfig.glm` / `GlobalConfig.webReader` 字段删除, `setup` 命令删除.
2. `mcpsmgr install owner/repo` 继续可用, 走规则化 README 分析.
3. `mcpsmgr install <github-url>` 支持 `https://github.com/owner/repo[/...]` 形态, 归一化成 owner/repo 处理.
4. `mcpsmgr install ./path.json` 支持多种 JSON 形状: `ServerDefinition`, Claude Code 的 `mcpServers`, OpenCode 的 `mcp`, Antigravity 的 `mcpServers` + `serverUrl`.
5. `mcpsmgr install ./path/dir` 延续当前行为 (manifest 探测).
6. `mcpsmgr update` 改跑规则化分析刷新配置.
7. 规则化分析失败时, 降级路径清晰 (manifest 兜底 → manual 向导).

**Non-Goals:**

- 不支持 `install` 非 GitHub 的任意 URL. 用户如果要装私仓或其它源, 先自己下成 local JSON.
- 不做 regex 启发式扫 README 正文 (ALL_CAPS 占位符等). env 键仅从抽到的结构化 block 中取, 值由用户交互输入.
- 不实现 LLM 的"智能自动 override"行为. 只有用户手写 JSON 的 `overrides` 字段才会被保留.
- 不保留 `~/.mcps-manager/config.json` 的向后兼容解析 (新版直接按新结构读; 旧字段静默丢弃, 不报错).

## Decisions

### D1: README 拉取策略 — fetch 首选, gh 降级

**选择**: 先尝试 `fetch https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`, 失败后再试大小写变体 `readme.md`, 最后降级到 `gh api /repos/{owner}/{repo}/readme --jq .content` (base64 解码).

**理由**:
- `fetch` 无外部依赖, 对公开仓库最常见场景最快.
- `raw.githubusercontent.com` 的 `HEAD` 语义会跟默认分支, 不需要预先查询.
- `gh` 作为降级保护私仓 / 异常命名 / 限速场景, 但不强制安装.

**替代方案被否**: 
- `git clone --depth 1` — 对"只读一个 README"太重.
- 只用 `gh` — 要求用户装 `gh`, 与"删依赖"的整体方向矛盾.
- 只用 `fetch` 不降级 — 私仓无法处理.

### D2: README 规则化分析的分层抽取策略

**优先级**:

```
P1  fenced code block 内扫 `claude mcp add ...` 行
    → shell-tokenize → 吃 -e/--env/-t/--transport/--url flag
    → 拿 name / command / args / env keys (from -e flags)

P2  fenced JSON block 匹配 mcpServers 形状
    → name = 首个 key
    → command / args / env keys from server config

P3  fenced JSON block 匹配裸 {command, args} 或 {url} 形状
    → 用 repo name 当默认 name, 让用户确认

P4  兜底 manifest: package.json → npx -y <name>
                    pyproject.toml → uvx <name>

P5  全部失败 → 降级 manual 向导
```

P1 与 P2 都命中时, **P1 为主** (name/command/args), **P2 补 env 键名**. 理由: `claude mcp add` 行是作者为 copy-paste 写的"官方推荐命令", 比给 Claude Desktop 用的 JSON block 更权威; JSON block 的 env 段通常更完整, 用来补键名.

**shell-tokenize 实现**: 支持单双引号, `\` 转义, 类 POSIX shell 语义. 可以自己写一个小解析器 (约 40 行), 不引额外依赖.

### D3: `claude mcp add` 扫描范围 — 仅限 fenced code block

**选择**: 只扫 ```` ``` ```` 包围的代码块, 不扫裸文段落.

**理由**: 
- 作者放进代码块的命令是"期望用户执行"的, 正文里的 `claude mcp add ...` 可能是"反面示例" / "如果你用 Claude Desktop 可以这样" 等叙述.
- 降低误报, 配合 P4 兜底能覆盖 99%+ 的合理 README.

### D4: 本地 JSON 多形状嗅探

尝试顺序:

```
1. ServerDefinition 形状 (有 name + default + overrides)  → 直接读
2. { mcpServers: { <name>: {...} } }                      → claude-code / gemini 共享
3. { mcp: { <name>: {...} } }                             → opencode
4. Antigravity shape (有 mcpServers 但条目含 serverUrl)   → 已被 2 兜住, 但要走 antigravity adapter
5. 都不中 → 报错退出
```

每种形状对应一个 adapter 的 `fromAgentFormat` (前面已有). 多 server 时用 `@inquirer/prompts` 的 `checkbox` 组件交互式多选, 默认选中所有.

### D5: `AnalysisResult` 形状保持不变

虽然移除 LLM, 但 `install.ts` 和 `update.ts` 只要从 `analyzeWithGlm(config, message)` 切到 `analyzeFromSource(source)` 就行, 签名近似. 新接口:

```typescript
// src/install/analyze.ts
interface AnalysisResult {
  name: string;
  default: DefaultConfig;
  overrides: Record<string, never>;  // 始终空 — 规则不再生成
  requiredEnvVars: readonly string[];
}

async function analyzeFromSource(source: string): Promise<AnalysisResult>;
```

`overrides: Record<string, never>` 空对象. ServerDefinition 的 overrides 字段定义不动, 只是分析流程不再写它. manual 向导继续可以给用户机会手写 overrides.

### D6: `setup` 命令删除, 运行时按需建目录

**选择**: 删掉 `mcpsmgr setup` 命令. `src/index.ts` 中的 `requireSetup()` 守卫函数也删掉. `~/.mcps-manager/servers/` 目录由第一次 `install` 或 `writeServerDefinition` 按需 `mkdir -p`.

**替代方案被否**:
- 保留一个退化的 setup 只建目录 — 徒增 UX 噪音, 不如静默处理.
- 彻底改成 `mcpsmgr init` — 跟项目级的 `mcpsmgr init` 命名冲突.

### D7: `GlobalConfig` 简化

旧:
```typescript
interface GlobalConfig {
  glm: { apiKey: string; endpoint: string };
  webReader: { apiKey: string; url: string };
}
```

新: **彻底去掉 GlobalConfig 类型和 `~/.mcps-manager/config.json` 文件**.

如果未来有真正的全局配置需求 (例如 "默认 agent 列表"), 再引回.

`src/utils/config.ts` 整个删除. `src/commands/install.ts` 和 `src/commands/update.ts` 里 `readGlobalConfig()` 调用删除.

### D8: 多 server 本地 JSON 的选择交互

**选择**: 交互式 checkbox 多选, 默认全选.

**替代方案被否**:
- 默认只装第一个 — 有 surprise 因子, 用户容易漏装.
- 强制全装无选择 — 用户可能只想装一个.
- 提供 `--all` flag — 保留给未来 "非交互 / CI" 场景, 本轮不做.

## Runtime Assumptions

本设计明确扫过, 检出以下需要 verification 的外部依赖:

### A1: `raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md` 返回默认分支的 README

**Assumption**: 使用 `HEAD` 作为 ref 会自动跟随仓库的默认分支 (main / master / 其它).

**Rationale**: GitHub 官方文档明确 `HEAD` ref 解析为仓库默认分支; 多个生产项目 (homebrew-core, various CI configs) 使用这个 pattern.

**Verification**: task 4.1 (manual-verify) — 对 `ahujasid/blender-mcp` (默认分支 `main`) 和一个默认分支为 `master` 的已知仓库同时试拉取, 确认都能成功.

### A2: `gh api /repos/{owner}/{repo}/readme` 返回 base64 encoded content

**Assumption**: GitHub REST API 的 `/repos/.../readme` 端点返回 JSON, `content` 字段是 base64, `encoding` 字段为 `"base64"`.

**Rationale**: 官方 REST API 文档规定.

**Verification**: task 4.2 (manual-verify) — 在本地装了 `gh` 的情况下手动跑一遍降级路径.

### A3: `@inquirer/prompts` 的 `checkbox` 组件支持 "默认全选"

**Assumption**: `checkbox({ choices: [{ name, value, checked: true }, ...] })` 的 `checked: true` 会让该项默认选中.

**Rationale**: Inquirer API 文档; 项目已在用该库其它组件.

**Verification**: task 5.3 (unit-test) — 不直接测 inquirer, 测调用 inquirer 的包装函数在 mock 下生成正确的 choices 数组.

### A4: shell-tokenize 自写实现覆盖 `claude mcp add` 行中的常见引号形态

**Assumption**: 自写的 POSIX shell tokenizer 能处理 `"..."`, `'...'`, `\` 转义. 不需要处理变量插值 / backtick / 管道.

**Rationale**: `claude mcp add` 行不含管道也不含变量; 只需支持引号和转义.

**Verification**: task 3.1 (unit-test) — 多个 tokenizer 单测覆盖引号 / 转义 / 空格 / 混合.

### A5: Node.js 的全局 `fetch` API 在运行时可用

**Assumption**: 项目打包产物在 Node 18+ 环境运行, 全局 `fetch` 已内置 (无需 `node-fetch` 依赖).

**Rationale**: `package.json` 不显式声明 `engines.node`, 但当前代码 (`src/services/web-reader.ts`) 已在裸用 `fetch`, 说明目标环境假设就是 Node 18+. `@types/node: ^25` 对应的类型也声明了 fetch.

**Verification**: accepted-risk — 当前代码已经依赖同一假设, 不是本 change 新增的风险面.

### A6: `gh` CLI 的 `gh api --jq` 输出为纯 stdout 字符串 (退出码 0 表示成功)

**Assumption**: `gh api /repos/{o}/{r}/readme --jq .content` 退出码 0 时 stdout 是 base64 字符串 (可能带 trailing newline), 非 0 时 stderr 含错误信息.

**Rationale**: `gh` 官方文档规定 `--jq` 对结果应用 jq 表达式后直接输出; `.content` 是字符串, 输出为纯文本.

**Verification**: task 2.3 (manual-verify) — 在装了 `gh` 且已认证的环境中手动跑一遍 README 降级拉取, 确认能还原成正确 README 文本.

## Risks / Trade-offs

- **Risk**: README 作者不遵守 `mcpServers` / `claude mcp add` 任一约定 → **Mitigation**: P4 兜底抓 manifest; P5 降级到 manual 向导. manual 向导不坏, 只是体验回退.
- **Risk**: `raw.githubusercontent.com` 对某些仓库返回 404 (README 文件名是 `README.rst` 或 `readme.md` 等) → **Mitigation**: 依次试 `README.md` / `readme.md`, 失败再走 `gh api` 降级 (后者能找任意大小写/后缀).
- **Risk**: 规则化 tokenizer 在边缘情况出错 (嵌套引号, UTF-8 奇异字符) → **Mitigation**: 单测覆盖 + 失败时抛出错误, 由上层降级到 P2/P3.
- **Risk**: 用户本地 JSON 形状不在已支持列表 (例如未来 Gemini CLI 改格式) → **Mitigation**: adapter 的 `fromAgentFormat` 是"尝试解析, 返回 undefined", 所有形状都 return undefined 时抛出清晰错误.
- **Risk**: 不再有 LLM "智能" 处理 URL 里的不规范 README → **Mitigation**: 明确拒绝非 GitHub URL, 引导用户用 `./local.json` 路径.
- **Trade-off**: 删掉 `mcpsmgr setup` 意味着旧用户升级时 `~/.mcps-manager/config.json` 里的 GLM 字段变"死字段". 不做迁移脚本, 因为这些字段本身就没有意义了.

## Migration Plan

按顺序实施:

1. **新增 `src/install/`** — 所有新模块带单测写入, 不动老代码 (这一步老代码仍在跑).
2. **改 `install.ts` 和 `update.ts`** — 把 `analyzeWithGlm` 的调用替换成 `analyzeFromSource`.
3. **删 `src/services/`** — GLM / webReader / system-prompt 全部移除.
4. **删 `src/commands/setup.ts`** 和 `src/index.ts` 中 `setup` 命令注册.
5. **删 `src/utils/config.ts`** 和 `GlobalConfig` 类型.
6. **更新 README.md / docs/README_zh-CN.md** — 删 GLM 章节, 改 install 流程描述.
7. **sync specs** — 让 main specs 反映新架构.

回滚策略: 本 change 是单向的 (移除 LLM), 回滚就是 `git revert`. 无数据迁移. 用户的 `~/.mcps-manager/servers/*.json` 不受影响.
