# Requirements: file-watcher

## Overview

主进程监听当前工作区目录的外部文件变更，并通过 `file:changed` 事件推送到渲染层。渲染层按规则响应：清理 tab 静默重载、脏 tab 标记冲突、文件树刷新。无变更时不打扰用户。

## Stakeholders

- **用户**: agent 或外部编辑器修改的文件能立即反映到工作区与文件树；不会因脏缓冲被静默覆盖。
- **开发者**: 单个 `FileWatcher` 服务，挂在主进程 IPC 之上，与现有 `fileService` / `workspaceStore` 解耦。

## Assumptions

- 当前工作区为单根目录（由 `workspaceStore.activeId` 或 `agentService.currentCwd` 决定）。
- macOS/Win 平台：`fs.watch(root, {recursive:true})` 有效；Linux 递归有限，做降级处理（仅监听顶层）。
- 已有 `file:read` IPC 可拉取最新内容。

## Acceptance Criteria (EARS)

- AC-1: WHEN 渲染层请求切换工作区（或 agentService cwd 变化）, THE SYSTEM SHALL 在主进程重启 watcher 监听新根目录。
- AC-2: WHEN 受监听目录下的文件被外部修改, THE SYSTEM SHALL 经 `file:changed` 事件发送 `{path, kind}`。
- AC-3: WHEN 渲染层收到 `file:changed`, THE SYSTEM SHALL 区分场景：无对应 tab → FileTree 刷新；有干净 tab → 静默重载（更新 content/mtime，不改 dirty）；有脏 tab → 标记冲突。
- AC-4: WHEN 主进程自身写入文件, THE SYSTEM SHALL 不触发渲染层重载（避免回声）。
- AC-5: WHEN 受监听目录超出限制（如 listen 报错), THE SYSTEM SHALL 不崩溃，仅记录日志。

## Out of Scope

- 多根目录监听。
- FileTree 的子目录 lazy load 优化（已有，独立迭代）。
- 编辑器内 highlight 远端未保存变更的细节行。
