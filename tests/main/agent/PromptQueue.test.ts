import { describe, expect, it } from 'vitest'
import { PromptQueue } from '../../../src/main/agent/PromptQueue'

/** spec: agent-service AC-1 —— PromptQueue 流式输入 */
describe('PromptQueue', () => {
  it('push 的文本以 SDKUserMessage 形态被迭代产出（AC-1）', async () => {
    const queue = new PromptQueue()
    queue.push('hello')
    queue.end()

    const received = []
    for await (const msg of queue) {
      received.push(msg)
    }

    expect(received).toEqual([
      {
        type: 'user',
        message: { role: 'user', content: 'hello' },
        parent_tool_use_id: null
      }
    ])
  })

  it('迭代器挂起等待新消息（不忙轮询），push 后唤醒', async () => {
    const queue = new PromptQueue()
    const iterator = queue[Symbol.asyncIterator]()

    // 无消息时 next() 挂起
    const pending = iterator.next()
    let settled = false
    void pending.then(() => {
      settled = true
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(settled).toBe(false)

    queue.push('wake up')
    const result = await pending
    expect(result.done).toBe(false)
    expect((result.value as { message: { content: string } }).message.content).toBe('wake up')
  })

  it('多轮消息保持 FIFO 顺序', async () => {
    const queue = new PromptQueue()
    queue.push('first')
    queue.push('second')
    queue.push('third')
    queue.end()

    const texts: string[] = []
    for await (const msg of queue) {
      texts.push(msg.message.content as string)
    }
    expect(texts).toEqual(['first', 'second', 'third'])
  })

  it('end() 后 push 不再产出', async () => {
    const queue = new PromptQueue()
    queue.end()
    queue.push('too late')

    const texts: string[] = []
    for await (const msg of queue) {
      texts.push(msg.message.content as string)
    }
    expect(texts).toEqual([])
  })
})
