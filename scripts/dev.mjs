#!/usr/bin/env node
/**
 * dev 启动器：包裹 electron-vite dev，监听 src/main / src/preload / src/shared
 * 任一文件变更即 kill+respawn，让 Electron 始终跑最新 bundle。
 * （替代 nodemon —— 在非 TTY 环境输出更可控）
 */
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const WATCH_DIRS = ['src/main', 'src/preload', 'src/shared']
const DEBOUNCE_MS = 200
const RESTART_DELAY_MS = 150 // 让 vite 写完 bundle 再重启

let child = null
let restartTimer = null
let debounceTimer = null

function start() {
  console.log('[dev] starting electron-vite dev…')
  child = spawn('npx', ['electron-vite', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env
  })
  child.on('exit', (code, signal) => {
    console.log(`[dev] electron-vite exited code=${code} signal=${signal}`)
    child = null
    // 主动 kill 重启（SIGTERM 在 Unix 上报为 exit code 143, signal=null）
    const wasSigterm = signal === 'SIGTERM' || code === 143 || code === null
    if (wasSigterm) return
    // 非零退出 = 异常
    if (code !== 0) {
      console.log('[dev] unexpected exit, restarting in 2s…')
      setTimeout(start, 2000)
    }
  })
}

function restart(reason) {
  if (restartTimer) return
  console.log(`[dev] change detected (${reason}), restarting in ${RESTART_DELAY_MS}ms…`)
  restartTimer = setTimeout(() => {
    restartTimer = null
    if (child) {
      child.kill('SIGTERM')
      // 等子进程退完再起
      child.once('exit', () => start())
    } else {
      start()
    }
  }, RESTART_DELAY_MS)
}

function scheduleRestart(filePath) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const rel = relative(ROOT, filePath)
    restart(rel)
  }, DEBOUNCE_MS)
}

// 对每个目录递归监听（fs.watch 递归是实验性的，跨平台不稳）
function watchRecursive(dir) {
  const abs = join(ROOT, dir)
  try {
    watch(abs, { recursive: true }, (event, filename) => {
      if (!filename) return
      if (!/\.(ts|js|mjs|cjs|json)$/.test(filename)) return
      scheduleRestart(join(abs, filename))
    })
    console.log(`[dev] watching ${dir}/**`)
  } catch (err) {
    // recursive 不可用时降级为非递归
    console.warn(`[dev] recursive watch failed for ${dir}, fallback to non-recursive: ${err.message}`)
    watch(abs, (event, filename) => {
      if (!filename) return
      if (!/\.(ts|js|mjs|cjs|json)$/.test(filename)) return
      scheduleRestart(join(abs, filename))
    })
    console.log(`[dev] watching ${dir}/* (non-recursive)`)
  }
}

WATCH_DIRS.forEach(watchRecursive)
start()

// 主进程退出时清理
process.on('SIGINT', () => {
  console.log('[dev] SIGINT, killing child…')
  if (child) child.kill('SIGTERM')
  process.exit(0)
})
process.on('SIGTERM', () => {
  if (child) child.kill('SIGTERM')
  process.exit(0)
})
