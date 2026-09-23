import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

/**
 * 流式输入队列 —— 实现 AsyncIterable<SDKUserMessage>。
 *
 * 流式输入模式是 query() 的中断（interrupt）与权限模式切换
 * （setPermissionMode）中途可用的前提；AgentService 从第一天起就用它。
 *
 * 语义：
 * - push(text): 追加一条用户消息；迭代方按 FIFO 收到
 * - end(): 结束迭代（查询自然收尾）
 * - 迭代方未调用 next() 时消息排队等待，不丢失
 */
export class PromptQueue implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = []
  private resolveNext: (() => void) | null = null
  private ended = false

  push(text: string): void {
    if (this.ended) return
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null
    })
    this.resolveNext?.()
  }

  end(): void {
    this.ended = true
    this.resolveNext?.()
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    const self = this
    return {
      next(): Promise<IteratorResult<SDKUserMessage>> {
        return new Promise((resolve) => {
          if (self.queue.length > 0) {
            resolve({ value: self.queue.shift()!, done: false })
            return
          }
          if (self.ended) {
            resolve({ value: undefined, done: true })
            return
          }
          // 无消息且未结束：挂起，直到 push/end 唤醒
          self.resolveNext = () => {
            self.resolveNext = null
            if (self.queue.length > 0) resolve({ value: self.queue.shift()!, done: false })
            else if (self.ended) resolve({ value: undefined, done: true })
          }
        })
      }
    }
  }
}
