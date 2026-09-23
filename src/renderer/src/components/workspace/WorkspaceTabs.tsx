import { useWorkspaceStore } from '../../state/workspaceStore'
import { useConfigStore } from '../../state/configStore'

export function WorkspaceTabs(): React.JSX.Element | null {
  const openIds = useWorkspaceStore((s) => s.openIds)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeId = useWorkspaceStore((s) => s.activeId)
  const switchWorkspace = useWorkspaceStore((s) => s.switch)
  const closeWorkspace = useWorkspaceStore((s) => s.close)
  const openNew = useWorkspaceStore((s) => s.open)
  const pickWorkspace = useConfigStore((s) => s.pickWorkspace)

  if (openIds.length === 0) return null

  const openWorkspaces = openIds
    .map((id) => workspaces.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => w !== undefined)

  const handleAdd = async (): Promise<void> => {
    await pickWorkspace()
    const path = useConfigStore.getState().cwd
    if (!path) return
    await openNew(path)
  }

  return (
    <div className="workspace-tabs" data-testid="workspace-tabs">
      {openWorkspaces.map((ws) => (
        <div
          key={ws.id}
          className={`workspace-tab ${ws.id === activeId ? 'active' : ''}`}
          data-testid={`workspace-tab-${ws.id}`}
          onClick={() => {
            if (ws.id !== activeId) void switchWorkspace(ws.id)
          }}
        >
          <span className="workspace-tab-name" title={ws.path}>{ws.name}</span>
          <button
            type="button"
            className="workspace-tab-close"
            data-testid={`workspace-close-${ws.id}`}
            onClick={(e) => {
              e.stopPropagation()
              void closeWorkspace(ws.id)
            }}
            aria-label={`关闭 ${ws.name}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="workspace-tab-add"
        data-testid="workspace-add"
        onClick={() => void handleAdd()}
        title="打开新工作区"
      >
        +
      </button>
    </div>
  )
}
