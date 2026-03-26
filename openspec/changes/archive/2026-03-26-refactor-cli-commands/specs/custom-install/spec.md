## ADDED Requirements

### Requirement: 从本地文件安装 MCP 服务

系统 SHALL 支持 `mcpsmgr custom-install <name>` 命令 (别名 `ci`), 从当前工作目录读取 `<name>.json` 文件并安装到中央仓库.

#### Scenario: 从本地 JSON 文件安装

- **WHEN** 用户在包含 `my-server.json` 的目录执行 `mcpsmgr custom-install my-server`
- **THEN** 系统读取 `./my-server.json`, 验证其符合 ServerDefinition 格式 (包含 name, default.transport, default.command 或 default.url), 将文件复制到 `~/.mcps-manager/servers/my-server.json`, source 字段设为 `local`

#### Scenario: 文件不存在时进入交互模式

- **WHEN** 用户执行 `mcpsmgr custom-install my-server` 但当前目录不存在 `my-server.json`
- **THEN** 系统进入交互式手动配置模式, 引导用户输入 transport, command, args, env 等信息, 生成的服务定义 source 标记为 `local`, 保存到中央仓库

#### Scenario: 无参数进入交互模式

- **WHEN** 用户执行 `mcpsmgr custom-install` 不提供 name 参数
- **THEN** 系统进入交互式手动配置模式, 先要求输入服务名 (kebab-case), 然后引导输入配置信息

### Requirement: custom-install 同名冲突检测

系统 SHALL 在 custom-install 时检测中央仓库中是否已存在同名服务.

#### Scenario: 同名服务已存在且无 --force

- **WHEN** 用户执行 `mcpsmgr custom-install my-server` 且中央仓库已有 `my-server`
- **THEN** 系统提示服务已存在, 询问是否覆盖

#### Scenario: 同名服务已存在且有 --force

- **WHEN** 用户执行 `mcpsmgr custom-install my-server --force` 且中央仓库已有 `my-server`
- **THEN** 系统直接覆盖, 不询问

### Requirement: custom-install 交互中断优雅退出

`mcpsmgr custom-install` 命令 SHALL 在用户按 Ctrl-C 中断任意 prompt 时正常退出, 不输出错误信息, 退出码为 0.

#### Scenario: 交互模式中按 Ctrl-C

- **WHEN** 用户在 custom-install 交互式配置的任意 prompt 中按 Ctrl-C
- **THEN** 系统 SHALL 静默退出, 不保存任何配置
