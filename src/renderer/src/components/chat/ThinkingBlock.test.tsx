import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThinkingBlock } from './ThinkingBlock'
import { useConfigStore } from '../../state/configStore'

describe('ThinkingBlock', () => {
  beforeEach(() => {
    useConfigStore.setState({
      thinkingDefaultExpanded: false,
      setThinkingDefaultExpanded: useConfigStore.getState().setThinkingDefaultExpanded
    })
  })

  it('默认折叠，显示摘要行', () => {
    render(<ThinkingBlock text="inner monologue" />)
    expect(screen.getByTestId('thinking-summary')).toHaveTextContent('思考过程')
    expect(screen.queryByTestId('thinking-body')).not.toBeInTheDocument()
  })

  it('点击摘要后展开，显示完整 thinking 文本', () => {
    render(<ThinkingBlock text="line 1\nline 2" />)
    fireEvent.click(screen.getByTestId('thinking-summary'))
    expect(screen.getByTestId('thinking-body')).toHaveTextContent('line 1')
    expect(screen.getByTestId('thinking-body')).toHaveTextContent('line 2')
  })

  it('空 thinking 不渲染（调用方控制）', () => {
    // 组件本身不判断空，调用方 MessageItem 负责
    render(<ThinkingBlock text="" />)
    expect(screen.getByTestId('thinking-block')).toBeInTheDocument()
  })

  /** spec: cursor-parity AC-9 —— 设置中"默认展开 thinking"开启后，新 ThinkingBlock 默认展开 */
  it('configStore.thinkingDefaultExpanded=true 时默认展开', () => {
    useConfigStore.setState({ thinkingDefaultExpanded: true })
    render(<ThinkingBlock text="expanded by default" />)
    expect(screen.getByTestId('thinking-body')).toHaveTextContent('expanded by default')
  })
})
