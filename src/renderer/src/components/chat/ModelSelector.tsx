import { useConfigStore } from '../../state/configStore'

const models = [
  { value: 'default', label: '默认' },
  { value: 'claude-sonnet-4-6-20251001', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-8-20251001', label: 'Claude Opus 4.8' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
]

export function ModelSelector({
  disabled
}: {
  disabled?: boolean
}): React.JSX.Element {
  const model = useConfigStore((s) => s.model)
  const setModel = useConfigStore((s) => s.setModel)
  const agentMode = useConfigStore((s) => s.agentMode)
  const isFake = agentMode === 'fake'

  return (
    <select
      className="model-selector"
      data-testid="model-selector"
      value={isFake ? 'fake-model' : model}
      disabled={disabled || isFake}
      onChange={(e) => void setModel(e.target.value)}
      title={isFake ? 'fake 模式下固定为 fake-model' : '模型'}
    >
      {isFake ? (
        <option value="fake-model">fake-model</option>
      ) : (
        models.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))
      )}
    </select>
  )
}
