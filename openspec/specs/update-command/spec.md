# update-command Specification

## Purpose
TBD - created by archiving change refactor-cli-commands. Update Purpose after archive.
## Requirements
### Requirement: 更新已安装的 MCP 服务配置

系统 SHALL 支持 `mcpsmgr update [name]` 命令, 根据已记录的 source 信息重新运行规则化分析并更新中央仓库中的服务配置.

#### Scenario: 更新指定服务

- **WHEN** 用户执行 `mcpsmgr update brave-search` 且该服务 source 不为空且不为 `local`
- **THEN** 系统 SHALL 使用已记录的 source (GitHub `owner/repo` 或 URL) 运行规则化 README 分析, 比对当前 default 配置与新配置的差异, 展示变更预览, 用户确认后更新 `~/.mcps-manager/servers/brave-search.json` 中的 default, 保留原有 env 中用户填写的值

#### Scenario: 更新所有服务

- **WHEN** 用户执行 `mcpsmgr update` 不指定 name
- **THEN** 系统 SHALL 遍历 `~/.mcps-manager/servers/` 中所有服务, 跳过 source 为空或为 `local` 的服务, 依次对有远端 source 的服务执行更新流程, 最终输出汇总: 更新数, 跳过数, 失败数

#### Scenario: 服务不存在

- **WHEN** 用户执行 `mcpsmgr update nonexistent` 且中央仓库无此服务
- **THEN** 系统 SHALL 报错, 提示服务不存在

#### Scenario: source 为空或 local 的服务

- **WHEN** 用户执行 `mcpsmgr update my-local-server` 且该服务 source 为 `local`
- **THEN** 系统 SHALL 提示该服务无远程来源, 无法自动更新

### Requirement: update 保留用户环境变量

系统 SHALL 在更新过程中保留用户已配置的环境变量值.

#### Scenario: 更新时保留 env 值

- **WHEN** 规则化分析返回新的 env 键列表, 且新列表中的 key 在旧配置中已存在
- **THEN** 系统 SHALL 保留旧配置中该 key 的值, 仅添加新增的 env key (值设为空字符串并提示用户填写)

### Requirement: update 失败不中断批量更新

单个服务更新失败 SHALL NOT 阻断其他服务的更新流程.

#### Scenario: 批量更新中部分失败

- **WHEN** 用户执行 `mcpsmgr update` 且某个服务的规则化分析失败 (如网络错误, README 格式不识别)
- **THEN** 系统 SHALL 记录失败信息, 继续处理下一个服务, 最终汇总中展示失败的服务名和原因

