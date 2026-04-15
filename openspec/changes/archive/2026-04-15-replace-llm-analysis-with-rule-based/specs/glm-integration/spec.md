## REMOVED Requirements

### Requirement: GLM5 API 调用

**Reason**: 移除对外部 LLM 的依赖, 改用规则化 README 分析 (详见 `readme-analysis` capability).

**Migration**: 无数据迁移. 用户 `~/.mcps-manager/config.json` 中的 `glm` 字段在新版中被忽略; 若需要清理, 可直接删除 config.json 文件.

### Requirement: Web Reader 工具集成

**Reason**: Web Reader 是 GLM5 的 function calling tool, 随 LLM 流程一并移除.

**Migration**: 无数据迁移. `~/.mcps-manager/config.json` 中的 `webReader` 字段在新版中被忽略.

### Requirement: GitHub README 优先获取

**Reason**: README 获取语义移入 `readme-analysis` capability, 并改为直接使用 fetch 或 `gh`, 不再经过 LLM.

**Migration**: `mcpsmgr install owner/repo` 的外部行为保持不变 (仍然优先读 README), 只是实现路径不同.

### Requirement: 分析结果结构化输出

**Reason**: LLM 结构化输出需求消失; 规则化分析的输出 shape 由 `readme-analysis` 和 `local-source-analysis` 定义.

**Migration**: 旧 `ServerDefinition` JSON 文件的 shape 保持向后兼容 (name / default / overrides 字段不变).

### Requirement: 多轮对话处理

**Reason**: LLM function calling 流程消失.

**Migration**: 无需迁移.
