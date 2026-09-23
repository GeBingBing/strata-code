# Tasks: inline-chat

## 1. EditorArea Cmd+K 注册

- [x] 1.1 实现: `EditorArea.handleMount` 用 `KeyMod.CtrlCmd | KeyCode.KeyK` 注册命令，触发 `setInlineChat` 状态
- [x] 1.2 实现: 同时把硬编码 Cmd+S 位掩码替换为 KeyMod/KeyCode 常量

## 2. InlineChat 浮层

- [x] 2.1 实现: 新增 `src/renderer/src/components/editor/InlineChat.tsx`：textarea + Enter 发送 / Esc 关闭
- [x] 2.2 实现: send 时构造 range 附件（start/end 来自传入 props）
- [x] 2.3 实现: 浮层位置 useState 计算并 absolute 定位在 editor-host 内

## 3. 回归验证

- [x] 3.1 `npm run typecheck` — passed
- [x] 3.2 `npm run test:renderer` — passed
- [ ] 3.3 手动: dev 中选中 → Cmd+K → 输入 → 发送（chat 出现 range attachment 消息）
