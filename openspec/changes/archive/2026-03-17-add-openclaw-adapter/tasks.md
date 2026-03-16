## 1. 依赖与类型

- [x] 1.1 安装 `json5` npm 依赖
- [x] 1.2 在 `src/types.ts` 的 `AgentId` 联合类型中添加 `"openclaw"`

## 2. JSON5 工具模块

- [x] 2.1 创建 `src/adapters/json5-file.ts`, 实现 `readJson5File` 和 `writeJson5File` 函数

## 3. OpenClaw 适配器

- [x] 3.1 创建 `src/adapters/openclaw.ts`, 实现 `openclawAdapter` (AgentAdapter 接口)
- [x] 3.2 在 `src/adapters/index.ts` 中导入并注册 `openclawAdapter`

## 4. 测试

- [x] 4.1 为 `json5-file.ts` 编写单元测试
- [x] 4.2 为 `openclaw.ts` 适配器编写单元测试, 覆盖读写/冲突/JSON5 解析等场景
