import { spawn } from 'node:child_process'
import type { GitCommit, GitStatus } from '@shared/types'

function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr || `git exited with code ${code}`))
    })
  })
}

export class GitService {
  async status(cwd: string): Promise<GitStatus> {
    try {
      const { stdout: branchOut } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
      const branch = branchOut.trim()
      const { stdout: porcelain } = await runGit(['status', '--porcelain'], cwd)
      const files = porcelain
        .split('\n')
        .filter((line) => line.length >= 3)
        .map((line) => {
          const status = line.slice(0, 2).trim()
          const path = line.slice(3).trim()
          return { path, status: normalizeStatus(status) }
        })
      return { branch, files }
    } catch {
      return { branch: '', files: [] }
    }
  }

  async diff(cwd: string, file?: string): Promise<string> {
    try {
      const args = file ? ['diff', '--', file] : ['diff']
      const { stdout } = await runGit(args, cwd)
      return stdout
    } catch {
      return ''
    }
  }

  async log(cwd: string, limit = 10): Promise<GitCommit[]> {
    try {
      const { stdout } = await runGit(
        ['log', `-n${limit}`, '--pretty=format:%h%x1f%s%x1f%ct'],
        cwd
      )
      return stdout
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [sha, message, ts] = line.split('\x1f')
          return {
            sha: sha ?? '',
            message: message ?? '',
            date: Number(ts) * 1000
          }
        })
    } catch {
      return []
    }
  }
}

function normalizeStatus(s: string): GitStatus['files'][number]['status'] {
  if (s === 'M') return 'M'
  if (s === 'A') return 'A'
  if (s === 'D') return 'D'
  if (s === 'R') return 'R'
  if (s === '??') return '?'
  if (s.includes('M')) return 'M'
  if (s.includes('D')) return 'D'
  return '?'
}
