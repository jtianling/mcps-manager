## MODIFIED Requirements

### Requirement: add 命令支持 --global flag

系统 SHALL 支持 `mcpsmgr add <input> --global`, 把所选 agent 的配置写到该 agent 的全局配置位置而非项目级位置. 仅声明了全局写入能力 (`globalDir()`) 且本身非全局 (`isGlobal !== true`) 的 adapter 支持 `--global`; 目前为 codex (`~/.codex/config.toml`) 与 opencode (`~/.config/opencode/opencode.json`). 中央仓库条目与 bundle 记录不受 `--global` 影响, 照常写入.

`--global` 对 central / bundle / manifest 三条 add 路径 SHALL 一致生效, 仅改变写入 agent 配置的目标目录.

#### Scenario: --global 写 codex 全局配置

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a codex --global`
- **THEN** 系统 SHALL 把 server 写入 `~/.codex/config.toml` 的 `[mcp_servers.*]`, 项目目录下 SHALL NOT 产生 `.codex/config.toml`

#### Scenario: --global 写 opencode 全局配置

- **WHEN** 用户执行 `mcpsmgr add jtianling/cross-agent-teams-mcp -a opencode --global`
- **THEN** 系统 SHALL 把 server 写入 `~/.config/opencode/opencode.json` 的 `mcp` 块, 项目目录下 SHALL NOT 产生 `opencode.json`

#### Scenario: --global 用于不支持全局写入的 agent

- **WHEN** 用户执行 `mcpsmgr add context7 -a gemini-cli --global`
- **THEN** 系统 SHALL 报错说明该 agent 不支持 `--global`, 退出码非零, 不写任何 agent 配置

#### Scenario: --global 用于本身已是全局的 agent

- **WHEN** 用户执行 `mcpsmgr add context7 -a antigravity --global` (antigravity 的配置本身就是全局文件)
- **THEN** 系统 SHALL 报错说明该 agent 配置本身即全局、无需 `--global`, 退出码非零
