/**
 * SVG 图标库 —— Cursor / VSCode 风格。
 * 全部 24×24 viewBox，stroke="currentColor"，通过 CSS color 调色。
 */

interface IconProps {
  size?: number
  className?: string
}

const base = (size = 22): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
})

export function FilesIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M3 7v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" opacity="0.5" />
    </svg>
  )
}

export function SessionsIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

export function SearchIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function SettingsIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function ChevronLeft({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function ChevronRight({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function CloseIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function NewFileIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6" />
      <path d="M9 15h6" />
    </svg>
  )
}

export function NewFolderIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M12 11v4" />
      <path d="M10 13h4" />
    </svg>
  )
}

export function EditIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4z" />
    </svg>
  )
}

export function TrashIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 6h18" />
      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function CopyIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function SendIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
      <path d="m22 2-11 11" />
    </svg>
  )
}

export function StopIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  )
}

export function PlayIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

export function SaveIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  )
}

export function RefreshIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

export function CommandIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </svg>
  )
}

export function BrainIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.5a3 3 0 0 0-3 3v0a3 3 0 0 0 .5 11.5A2.5 2.5 0 0 0 7 22h10a2.5 2.5 0 0 0 2.5-2.5A3 3 0 0 0 20 8a3 3 0 0 0-3-3v-.5A2.5 2.5 0 0 0 14.5 2 2.5 2.5 0 0 0 12 4a2.5 2.5 0 0 0-2.5-2z" />
      <path d="M12 4v18" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </svg>
  )
}

export function GitIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 8v8" />
      <path d="M6 12h6a4 4 0 0 0 4-4" />
    </svg>
  )
}

/** 单纯的文件（带折角），用于 mention / 文件项；区别于 FilesIcon（文件夹+文件复合） */
export function FileIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

/** 闭合的文件夹 */
export function FolderIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

/** 展开的文件夹（FileTree 展开态用） */
export function FolderOpenIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H3z" />
      <path d="M3 9h16.5a1.5 1.5 0 0 1 1.45 1.94l-1.85 7A2 2 0 0 1 17.18 19H5a2 2 0 0 1-2-2V7z" opacity="0.5" />
    </svg>
  )
}

/** 对话气泡（WelcomePage 新对话卡片用） */
export function ChatIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

/** 键盘（WelcomePage 快捷键卡片用） */
export function KeyboardIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01" />
      <path d="M10 10h.01" />
      <path d="M14 10h.01" />
      <path d="M18 10h.01" />
      <path d="M6 14h.01" />
      <path d="M18 14h.01" />
      <path d="M7 18h10" />
    </svg>
  )
}

/** 备忘录 / 空编辑器占位 */
export function MemoIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  )
}

/** 成功 / 已完成（对勾） */
export function CheckIcon({ size, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}