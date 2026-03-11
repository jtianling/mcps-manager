## Context

当前 `init` 命令在服务器选择阶段硬编码 `checked: true`, 导致所有中央仓库中的服务默认全选. 实际上 `AgentAdapter` 接口已提供 `read(projectDir)` 方法, 可以读取目标目录各 agent 配置文件中已存在的 MCP 服务. 只需在展示 checkbox 前收集已存在的服务名, 据此决定默认选中状态.

## Goals / Non-Goals

**Goals:**

- init 命令的服务器选择默认状态反映目标目录的真实配置
- 已存在于目标目录中的服务标记 `(detected)` 并默认选中
- 不存在于目标目录中的服务默认不选中

**Non-Goals:**

- 不改变 agent 选择逻辑 (已正确实现检测)
- 不改变 write 阶段的冲突检测机制
- 不修改 adapter 接口

## Decisions

### 决策 1: 使用已选中 agent 的 `read()` 方法收集已有服务名

在 agent 选择完成后, 对每个选中的 agent 调用 `read(projectDir)`, 收集所有已存在的服务名到一个 `Set<string>`. 服务器 checkbox 中, 仅当服务名存在于该 Set 中时默认选中.

**备选方案**: 在 agent 选择前就读取所有 detected agent 的配置. 但这样可能读取用户最终未选中的 agent, 且增加不必要的 IO.

**选择理由**: 基于用户实际选中的 agent 来决定, 更精确且符合用户意图.

### 决策 2: 任一 agent 包含即标记为 detected

只要有一个已选中的 agent 中包含该服务, 就认为服务是 "detected" 的. 这样更友好 - 用户不会因为部分 agent 未配置而看到服务默认不选中.

### 决策 3: read() 失败时静默降级

如果某个 agent 的 `read()` 调用失败 (如文件损坏), 跳过该 agent 的检测, 不阻断整个流程.

## Risks / Trade-offs

- [Agent 选择后才能展示服务器列表] → 这是当前已有的流程, 不改变交互顺序
- [read() 可能返回非 mcpsmgr 管理的手动配置的服务] → 无影响, 只是用于决定默认选中, 用户仍可手动调整
