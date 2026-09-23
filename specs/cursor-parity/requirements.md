# Requirements: cursor-parity

## Overview

把聊天渲染、流式输出、工具结果展示对齐到 Cursor 级别的体验：

- **MVP（必须）**：
 1. 代码块语法高亮（shiki，VSCode 同款质量）
 2. 代码块右上角 hover 复制按钮（⎘）
 3. 工具结果（Read 文件内容）优化：文件路径面包屑 + 行号 + 语法高亮 + 折叠
 4. 流式进度提示（生成中显示"已输出 N tokens"，回复结束时自然消失）

- **Stretch（按需迭代）**：
 5. 多代码块交错（并行生成双栏布局）
 6. Checkpoint（生成中可中断并从指定中间状态继续）
 7. thinking 策略调整（默认折叠/隐藏 + 用户切换）

## Stakeholders

- **用户**: 期望代码块、工具结果与 Cursor 一样可直接读、可复制、可跳转；流式时知道进度。
- **开发者**: 渲染层组件扩展，markdown 流式管线增加高亮与自定义 code 组件；不破坏现有 AC。

## Assumptions

- Electron 桌面应用，bundle 体积不是瓶颈——shiki 的几 MB 可接受。
- Markdown 配置：`remark-gfm`（表格/删除线/任务列表）+ `rehype-highlight` 不会引入冲突；选 `shiki/bundle/web` 路径按需载入。
- 代码高亮语言子集：ts, tsx, js, jsx, json, bash, shell, python, css, html, markdown, yaml, diff, go, rust, sql, vue。后续可按需扩展。
- 主题：单主题 `github-light`（明暗跟随系统后续 stretch）；MVP 阶段明暗统一。
- 复制功能通过 `navigator.clipboard.writeText`（现有 CodeButton 用同 API）。
- ToolCallCard 的"Read 工具"识别：通过 toolName === 'Read'，input 提取 file_path。Edit/Write 已有 DiffPreview 不重复。

## Acceptance Criteria (EARS)

### MVP

- AC-1: WHEN markdown 内容含 ```ts 代码块, THE SYSTEM SHALL 以 shiki 渲染并应用关键字/字符串/数字等语法颜色（与 Cursor 视觉一致）。
- AC-2: WHEN 用户 hover 代码块右上角, THE SYSTEM SHALL 显示 ⎘ 复制按钮；点击后将该代码块文本写入剪贴板，复制成功按钮短暂高亮。
- AC-3: WHEN 工具调用为 Read 且 input.file_path 存在, THE SYSTEM SHALL 在 ToolCallCard 顶部显示文件路径面包屑（含 basename + 完整路径 hover 提示）。
- AC-4: WHEN Read 工具的输出是文件内容, THE SYSTEM SHALL 显示行号（每行前灰色 1-2 位序号）+ shiki 语法高亮，且默认折叠（用户展开才可见）。
- AC-5: WHEN agent 处于 running 状态且本回合已有 partial 输出, THE SYSTEM SHALL 在状态栏或流式气泡旁显示"已输出 N tokens"（N 来自累积 text 长度估算，结束后消失）。
- AC-6: WHEN 流式 markdown 渲染包含空代码块或不识别语言的代码块, THE SYSTEM SHALL 不抛错，使用纯文本等宽回退（不破坏现有流式性能预算）。

### Stretch（spec 内列项，后续单独迭代时实现）

- AC-7: WHEN 用户在生成中点击停止, THE SYSTEM SHALL 保留当前已输出内容（已实现）并允许用户在 composer 修改后点击"从这里继续"——在保留上下文的基础上追加。
- AC-8: WHEN 多个独立代码块同时处于流式, THE SYSTEM SHALL 支持左右双栏并排展示（桌面端宽屏）。
- AC-9: WHEN thinking 折叠块默认显示策略, THE SYSTEM SHALL 折叠首次见到的新会话（chat-ui AC-1 保留）；提供 toggle 切换展开/折叠全局默认。

## Out of Scope

- AI 推理路径的"分支"概念（Agent SDK 不支持中途中途切换模型/分支）。
- 工具调用的"重试"按钮（已是 AgentService dispose + 重发模式，UI 不暴露）。
- 代码块的"在编辑器中打开"功能（涉及编辑器 API 联动，独立 spec）。
- Cursor 的 Apply 按钮（项目 Edit/Write 走 PermissionBridge 审批流，已存在）。