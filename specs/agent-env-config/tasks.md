# Tasks: agent-env-config

- [x] 1.1 失败测试: parseEnvFile 基本 KV / 注释 / 空行 / 引号 / 值含 = (AC-1/3) → `tests/main/config/env.test.ts`
- [x] 1.2 失败测试: loadEnvOverrides 缺失文件 → {} (AC-2) → 同上
- [x] 1.3 实现 `src/main/config/env.ts`
- [x] 2.1 失败测试: AgentService 传递 options.env 到 query (AC-4) → `AgentService.test.ts`
- [x] 2.2 AgentServiceOptions.env + start() 透传
- [x] 3.1 main/index.ts 组装 env（userData/.env 优先于项目根 .env）并注入 AgentService
- [x] 3.2 .env.example 模板（MiniMax Anthropic 兼容示例）
- [x] 3.3 全部测试跑绿（40/40）+ typecheck 干净
