# Tasks: memory-injection

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. MemoryInjector

- [x] 1.1 失败测试: 空库 → buildAppend 返回 '' 且不发事件 → `tests/main/memory/MemoryInjector.test.ts` (AC-1)
- [x] 1.2 失败测试: global + cwd 匹配 project 入选；其他 cwd 的 project 条目排除（含父目录前缀匹配）→ 同上 (AC-2)
- [x] 1.3 失败测试: firstText tag 重叠打分 → top-N（12 条 + 4 skills）与 2000 字符预算截断 → 同上 (AC-3)
- [x] 1.4 失败测试: `<memory>` 模板分区与 "When <tags>: <content>" skill 行格式；空分区省略 → 同上 (AC-4)
- [x] 1.5 失败测试: 选中非空 → memory:recalled 事件载荷（sessionId 命中与 '' 回退）→ 同上 (AC-5)
- [x] 1.6 失败测试: store.list() reject → 返回 '' 不抛 → 同上 (AC-6)
- [x] 1.7 实现 `src/main/memory/MemoryInjector.ts`

## 2. IPC 契约与接线

- [x] 2.1 ipc.ts 增加 `memory:recalled` / `memory:distilled` 事件通道与 `memory:list` / `memory:delete` invoke 通道（编译即验证；渲染层订阅在 memory-rendering spec）
- [x] 2.2 index.ts 接线: MemoryStore + MemoryInjector 实例化，injector.buildAppend 作为 buildSystemPromptAppend（含 APP_MEMORY_ENABLED 总开关；e2e 在 memory-rendering 覆盖）
