import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk'
import { useConfigStore } from '../../state/configStore'

const modes: { value: PermissionMode; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'acceptEdits', label: '自动接受编辑' },
  { value: 'plan', label: '计划模式' },
  { value: 'bypassPermissions', label: '绕过权限' }
]

export function PermissionModeSelector({
  disabled
}: {
  disabled?: boolean
}): React.JSX.Element {
  const permissionMode = useConfigStore((s) => s.permissionMode)
  const setPermissionMode = useConfigStore((s) => s.setPermissionMode)

  return (
    <select
      className="permission-mode-selector"
      data-testid="permission-mode-selector"
      value={permissionMode}
      disabled={disabled}
      onChange={(e) => void setPermissionMode(e.target.value as PermissionMode)}
      title="权限模式"
    >
      {modes.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  )
}
