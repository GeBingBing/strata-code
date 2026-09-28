# Strata Code

<p align="left">
  <a href="https://github.com/GeBingBing/strata-code/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/GeBingBing/strata-code/ci.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/GeBingBing/strata-code?style=flat-square&color=blue"></a>
  <a href="https://github.com/GeBingBing/strata-code/releases"><img alt="Release" src="https://img.shields.io/github/v/release/GeBingBing/strata-code?style=flat-square&color=success"></a>
  <a href="https://github.com/GeBingBing/strata-code/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/GeBingBing/strata-code?style=flat-square&color=yellow"></a>
  <a href="https://github.com/GeBingBing/strata-code/network/members"><img alt="Forks" src="https://img.shields.io/github/forks/GeBingBing/strata-code?style=flat-square&color=lightgrey"></a>
</p>

<p align="left">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white&style=flat-square">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square">
  <img alt="Claude Agent SDK" src="https://img.shields.io/badge/Claude_Agent_SDK-0.3-D97757?logo=anthropic&logoColor=white&style=flat-square">
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-4-6E9F18?logo=vitest&logoColor=white&style=flat-square">
  <img alt="Platform" src="https://img.shields.io/badge/macOS-arm64-lightgrey?style=flat-square&logo=apple&logoColor=white">
</p>

> **Cursor's anatomy, open source.** A desktop AI coding assistant built on the
> [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) —
> with layered memory, multi‑workspace, and interruptible streaming.

Electron + React + TypeScript. macOS / arm64 today, more platforms pending.

---

## Why Strata Code?

Most forks of Claude Code stop at "wrap it in a window." **Strata Code** ships the
streaming, tool‑use, and permission dialogs you'd expect, plus a few things most
forks skip:

| Feature | What it does |
|---|---|
| 🧠 **Three‑layer memory** | `MemoryStore` (persisted JSON) → `MemoryInjector` (deterministic scoring on every turn) → `MemoryDistiller` (post‑session side‑query that physically isolates from the main loop). No embeddings — offline‑testable, any model. |
| 🗂 **Multi‑workspace tabs** | Open several projects side by side, switch instantly, persist view state per workspace. |
| ⏯ **Interruptible streams** | Mid‑turn interrupt, mid‑turn permission mode change, mid‑turn context switch — all safe via `PromptQueue` (AsyncIterable input). |
| 🛡 **Permission bridge** | `canUseTool` ↔ renderer dialog with deny‑on‑abort / deny‑on‑window‑destroyed / idempotent respond. Never hangs the agent loop. |
| 🌫 **Fake mode** | `APP_AGENT_MODE=fake` runs a deterministic FakeAgent (echo + canned tool calls) — zero network, zero SDK subprocesses. E2E and offline dev are first‑class. |
| 📦 **Production packaging** | SDK native binaries externalized through `externalizeDepsPlugin` + `asarUnpack` so the `child_process` shim still resolves post‑build. |

---

## Quick start

```bash
# Requires Node 24 (see .nvmrc — system Node 16 is too old)
nvm use

npm install

# Real Claude (needs ANTHROPIC_API_KEY or a logged-in Claude subscription)
ANTHROPIC_API_KEY=sk-xxx npm run dev

# Offline / fake mode — zero network, zero subprocesses
APP_AGENT_MODE=fake npm run dev
```

## Test

```bash
npm test              # main (node) + renderer (jsdom) unit tests
npm run test:e2e      # Playwright Electron E2E (fake mode)
npm run typecheck     # dual tsconfig typecheck
```

## Package

```bash
npm run pack   # unpacked dir build — verifies asarUnpack + SDK binaries
npm run dist   # signed/notarized dmg (configure CSC_NAME for release)
```

---

## Architecture

```
┌─────────────────────────────┐                ┌──────────────────────────────┐
│  Renderer (React + zustand) │  ← typed IPC ─→│  Main process                │
│                             │  src/shared/   │                              │
│  • ChatView / Composer      │   ipc.ts       │  AgentService                │
│  • ToolCard / DiffPreview   │   (single      │    └─ PromptQueue            │
│  • PermissionRequest        │    source of   │    └─ PermissionBridge       │
│  • Sidebar (search/git/mem) │    truth)      │    └─ MemoryInjector         │
└─────────────────────────────┘                │    └─ MemoryDistiller        │
                                               │         └─ side query (1 turn)│
                                               │  claude-agent-sdk query()    │
                                               └──────────────────────────────┘
```

**The IPC contract is a single TypeScript module** (`src/shared/ipc.ts`). Adding a
channel means editing one file — the main handler, preload bridge, and renderer
client all type‑check against it. Misspelled channel = compile error, not runtime
mystery.

### Memory sub‑system (the standout)

```
                      ┌──────────────────────────────┐
   turn start ──►     │ MemoryInjector.buildAppend   │──► systemPrompt.append
                      │  scope filter → score → cap   │     + emit memory:recalled
                      └──────────────────────────────┘
                                  ▲
                                  │ read
                      ┌──────────────────────────────┐
   userData/memory.json         │ MemoryStore (atomic JSON)         │
                      └──────────────────────────────┘
                                  ▲
                                  │ replace (merge+prune)
                      ┌──────────────────────────────┐
   run complete ──►   │ MemoryDistiller              │──► emit memory:distilled
                      │  read transcript → side query │
                      │  → validate → mergeEntries   │
                      │  log-and-stop on any failure │
                      └──────────────────────────────┘
```

The distiller is a **physically isolated** side query (`maxTurns: 1`, no
`resume`, no `canUseTool`, no shared state). It can fail in any number of ways
without ever disturbing the main agent loop. See `specs/memory-distillation/`.

---

## Development methodology

We follow **SDD + TDD** strictly — see [`CLAUDE.md`](./CLAUDE.md) and [`specs/`](./specs/).

- Every feature starts in `specs/<feature>/requirements.md` (EARS‑style acceptance criteria)
- Then `design.md` (contracts + test strategy)
- Then `tasks.md` (checklist; the only source of truth for progress)
- Tests are written **before** implementation (red → green → refactor)

```
specs/
├── agent-service/           # streaming AgentService lifecycle
├── memory-{core,injection,distillation}/
├── permission-approval/     # the three-piece permission bridge
├── workspace-{foundation,management}/
├── chat-ui/                 # renderer chat surface
├── cursor-parity/           # ongoing Cursor/Codex feature parity
├── sdk-mock/                # unified SDK mock for tests
├── fake-mode/               # FakeAgent + FakeDistiller
└── ... 32 specs total
```

---

## Project layout

```
src/
├── main/                    # Electron main process (Node)
│   ├── agent/               # AgentService, PermissionBridge, PromptQueue, FakeAgent
│   ├── memory/              # MemoryStore / Injector / Distiller
│   ├── sessions/ workspace/ files/ git/ search/
│   └── ipc.ts + ipc-interfaces.ts
├── preload/                 # contextBridge: typed API surface
├── shared/                  # IPC contracts (src of truth) + types
│   └── ipc.ts types.ts
└── renderer/                # React 19 + zustand
    ├── src/state/           # stores (chat / session / editor / workspace / ...)
    ├── src/components/      # ChatView, Composer, ToolCallCard, DiffPreview, ...
    └── src/lib/             # applySdkMessage (pure reducer)
tests/                       # vitest (main node) + vitest (renderer jsdom) + e2e
```

---

## Requirements

- **Node 24** (`.nvmrc`) — system Node 16 cannot run Vite 7 / Vitest 4
- **macOS** for `npm run pack` / `dist` today (Windows / Linux targets are future work)
- `ANTHROPIC_API_KEY` for the real agent, or `APP_AGENT_MODE=fake` for offline

## License

[MIT](./LICENSE)

## Acknowledgements

- Built on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) by Anthropic
- Inspired by the UX of Cursor and Claude Code

---

<p align="center">
  <sub>If Strata Code makes your work easier, consider giving it a <strong>⭐ star</strong> — it helps others find it.</sub>
</p>

<p align="center">
  <a href="https://github.com/GeBingBing"><img alt="Author" src="https://img.shields.io/badge/author-@GeBingBing-blue?style=flat-square&logo=github"></a>
  <a href="https://github.com/GeBingBing/strata-code/issues/new"><img alt="Report a bug" src="https://img.shields.io/badge/-Report%20a%20bug-red?style=flat-square&logo=github"></a>
  <a href="https://github.com/GeBingBing/strata-code/issues/new"><img alt="Request a feature" src="https://img.shields.io/badge/-Request%20a%20feature-green?style=flat-square&logo=github"></a>
</p>
