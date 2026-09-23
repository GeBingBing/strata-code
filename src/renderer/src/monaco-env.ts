/**
 * Monaco Editor 在 Vite/Electron 环境下的 worker 配置。
 *
 * @monaco-editor/react 默认会从 CDN 加载 monaco 与 worker，
 * 在 Electron 离线 / CDN 不可达时会卡在 loading。
 * 这里改成使用 Vite 的 ?worker import 把 monaco 的 worker 内联打包。
 */
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'json') return new jsonWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html') return new htmlWorker()
    return new editorWorker()
  }
}

// 静默引用防止 tree-shake 删除
void monaco