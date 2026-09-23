import type { PermissionRequest } from '@shared/types'
import { usePermissionStore } from '../../state/permissionStore'
import { DiffPreview } from '../diff/DiffPreview'
import { diffFromToolInput } from '../../lib/diffFromToolInput'

/**
 * 内嵌权限请求（Cursor 风格）—— 显示在对话流中。
 */
export function PermissionRequestItem({ request }: { request: PermissionRequest }): React.JSX.Element {
  const respond = usePermissionStore((s) => s.respond)
  const diff = diffFromToolInput(request.toolName, request.input as Record<string, unknown> | undefined)

  return (
    <div className="permission-request" data-testid={`permission-request-${request.id}`}>
      <div className="permission-header">
        <span className="permission-icon">🔐</span>
        <span className="permission-tool">{request.toolName}</span>
        {request.title && <span className="permission-title">{request.title}</span>}
      </div>
      {request.description && <p className="permission-desc">{request.description}</p>}
      {request.decisionReason && <p className="permission-reason">原因: {request.decisionReason}</p>}
      <details className="permission-args">
        <summary>查看参数</summary>
        <pre>{JSON.stringify(request.input, null, 2)}</pre>
      </details>
      {diff && <DiffPreview filePath={diff.filePath} patch={diff.patch} />}
      <div className="permission-actions">
        <button
          type="button"
          className="permission-btn allow"
          data-testid={`permission-allow-${request.id}`}
          onClick={() => void respond(request.id, 'allow')}
        >
          允许
        </button>
        <button
          type="button"
          className="permission-btn always"
          data-testid={`permission-always-${request.id}`}
          disabled={!request.suggestions?.length}
          onClick={() => void respond(request.id, 'alwaysAllow')}
          title="总是允许此类操作"
        >
          总是允许
        </button>
        <button
          type="button"
          className="permission-btn deny"
          data-testid={`permission-deny-${request.id}`}
          onClick={() => void respond(request.id, 'deny')}
        >
          拒绝
        </button>
      </div>
    </div>
  )
}