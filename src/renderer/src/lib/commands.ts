/**
 * 命令面板注册表（Cmd+Shift+P）。
 * 全局命令通过 registerCommand 注册，UI 端通过 CommandPalette 调用。
 */

export interface Command {
  id: string
  label: string
  description?: string
  /** 快捷键提示，如 "Cmd+Shift+N" */
  shortcut?: string
  category?: string
  action: () => void | Promise<void>
}

type Listener = () => void
const listeners = new Set<Listener>()
let commands: Command[] = []

export function registerCommand(cmd: Command): () => void {
  commands = [...commands.filter((c) => c.id !== cmd.id), cmd]
  listeners.forEach((l) => l())
  return () => {
    commands = commands.filter((c) => c.id !== cmd.id)
    listeners.forEach((l) => l())
  }
}

export function registerCommands(cmds: Command[]): () => void {
  cmds.forEach((c) => registerCommand(c))
  const unsubs = cmds.map((c) => c.id)
  return () => {
    commands = commands.filter((c) => !unsubs.includes(c.id))
    listeners.forEach((l) => l())
  }
}

export function getCommands(): Command[] {
  return commands
}

export function subscribeCommands(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function setCommands(list: Command[]): void {
  commands = list
  listeners.forEach((l) => l())
}