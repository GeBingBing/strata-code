# Tasks: memory-distillation

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. distillPrompt 纯函数

- [x] 1.1 失败测试: truncateMiddle 超长 → 保留头尾去中段；未超长原样 → `tests/main/memory/distillPrompt.test.ts`
- [x] 1.2 失败测试: buildDistillPrompt 含转录文本与现有条目（带 id，供 retire 提案）→ 同上
- [x] 1.3 失败测试: extractJson 剥栅栏/首个平衡对象/失败返回 null → 同上
- [x] 1.4 失败测试: validateDrafts 丢非法 kind、钳制 content≤500 与 confidence∈[0,1]、补默认字段 → 同上
- [x] 1.5 实现 `src/main/memory/distillPrompt.ts`

## 2. MemoryDistiller

- [x] 2.1 失败测试: numTurns < minTurns → 不调 factory → `tests/main/memory/MemoryDistiller.test.ts` (AC-1)
- [x] 2.2 失败测试: 转录空/reject → 跳过不抛 → 同上 (AC-2)
- [x] 2.3 失败测试: 长转录中段截断进 prompt → 同上 (AC-3)
- [x] 2.4 失败测试: factory 收到 {prompt: string, options:{maxTurns:1, cwd}} 无 resume/canUseTool → 同上 (AC-4)
- [x] 2.5 失败测试: 合法提案 → merge+prune → store.replace + memory:distilled 事件 → 同上 (AC-5/6)
- [x] 2.6 失败测试: factory 抛异常 / JSON 全烂 → 吞掉不抛、无事件 → 同上 (AC-8)
- [x] 2.7 失败测试: 同 session in-flight 二次触发 → factory 一次 → 同上 (AC-7)
- [x] 2.8 失败测试: dispose → abort 被调 → 同上 (AC-9)
- [x] 2.9 实现 `src/main/memory/MemoryDistiller.ts`

## 3. FakeDistiller 与接线

- [x] 3.1 失败测试: createFakeDistillQueryFactory 产出 assistant(固定 JSON)+result → `tests/main/agent/FakeDistiller.test.ts` (AC-10)
- [x] 3.2 失败测试: FakeAgent result num_turns=2 + memory_recall yield 脚本 → 同上
- [x] 3.3 实现 `src/main/agent/FakeDistiller.ts` + FakeAgent num_turns 调整
- [x] 3.4 index.ts 接线: distiller 实例化（fake/real 分支、canned transcript、onRunComplete、before-quit dispose）
