# Requirements: session-history

## Overview

会话历史：轻量索引（`userData/sessions.json`）+ 侧栏列表 + 恢复/重命名/删除。完整对话由 SDK 自身持久化（`persistSession` 默认开启），本功能只维护索引并在恢复时用 `query({options:{resume: sessionId}})` 重建上下文。

## Stakeholders

- **用户**: 退出应用后回来能继续之前的对话，上下文完整。
- **开发者**: SessionStore 是纯 JSON 读写，必须原子写（防崩溃损坏）。

## Acceptance Criteria (EARS)

- AC-1: WHEN 新会话捕获到 SDK session id, THE SYSTEM SHALL 在索引中创建条目 {id, title(首条用户消息前 80 字符), cwd, createdAt, updatedAt}。
- AC-2: WHEN 会话有新活动, THE SYSTEM SHALL 更新该条目的 updatedAt。
- AC-3: WHEN 渲染进程调用 sessions:list, THE SYSTEM SHALL 返回按 updatedAt 降序的全部条目。
- AC-4: WHEN 用户打开历史会话, THE SYSTEM SHALL 以 resume 模式启动查询并回放历史消息（sessions:read → SDK getSessionMessages）。
- AC-5: WHEN 用户重命名/删除会话, THE SYSTEM SHALL 更新索引；删除同时调用 SDK deleteSession 清理完整转录。
- AC-6: IF 索引文件损坏或不存在, THE SYSTEM SHALL 以空索引启动（不崩溃）。
- AC-7: WHEN 写入索引, THE SYSTEM SHALL 先写临时文件再原子 rename（防半写状态）。

## Out of Scope

- 跨项目工作区管理、会话搜索（MVP 后）。
- 会话导出。
