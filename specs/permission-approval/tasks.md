# Tasks: permission-approval

> **测试先行**：任务 1 的全部红测试在任何实现之前完成。

## 1. 红测试（先写，全部失败）

- [x] 1.1 失败测试: canUseTool → permission:request 带唯一 id；respond → Promise 决议 (AC-1/2) → `tests/main/agent/PermissionBridge.test.ts`
- [x] 1.2 失败测试: abort signal → 该请求 deny、Promise 不悬挂 (AC-3) → 同上
- [x] 1.3 失败测试: webContents 销毁 → 全部 pending deny (AC-4) → 同上
- [x] 1.4 失败测试: 未知 id respond 不抛异常；重复 respond 幂等 (AC-5) → 同上
- [x] 1.5 失败测试: always-allow 透传 updatedPermissions (AC-6) → 同上
- [x] 1.6 失败测试: 窗口已销毁时新请求直接 deny（竞态）

## 2. 实现（使红测试变绿）

- [x] 2.1 实现 `src/main/agent/PermissionBridge.ts`（pending Map + uuid + 三重悬挂防线）
- [x] 2.2 注册 permission:respond IPC handler；AgentService options.canUseTool = bridge.handler
- [x] 2.3 渲染端 permissionStore（pending 请求状态）+ respond 动作

## 3. 对话框 UI（TDD）

- [x] 3.1 失败测试: PermissionDialog 渲染工具名/参数摘要/三按钮 (AC-7) → `PermissionDialog.test.tsx`
- [x] 3.2 失败测试: 点击按钮 → 正确 decision 回应；Esc=拒绝；Edit 请求内嵌 diff → 同上
- [x] 3.3 实现 PermissionDialog 组件（模态、Esc=拒绝、diff 预览）
- [x] 3.4 全部测试跑绿（6 bridge 用例 + 7 dialog 用例）
