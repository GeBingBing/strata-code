import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom 未实现 scrollIntoView
Element.prototype.scrollIntoView = () => {}

afterEach(() => {
  cleanup()
})
