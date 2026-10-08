'use client'

import { useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
}

function ToolbarButton({
  label,
  onClick,
  title,
}: {
  label: string
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
    >
      {label}
    </button>
  )
}

export function RichEmailEditor({ value, onChange, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '<p></p>'
    }
  }, [value])

  function exec(cmd: string, arg?: string) {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function addLink() {
    const url = window.prompt('Link URL (https://…)')
    if (!url) return
    exec('createLink', url)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <ToolbarButton label="B" title="Bold" onClick={() => exec('bold')} />
        <ToolbarButton label="I" title="Italic" onClick={() => exec('italic')} />
        <ToolbarButton label="U" title="Underline" onClick={() => exec('underline')} />
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <ToolbarButton label="H2" title="Heading" onClick={() => exec('formatBlock', 'h2')} />
        <ToolbarButton label="• List" title="Bullet list" onClick={() => exec('insertUnorderedList')} />
        <ToolbarButton label="1. List" title="Numbered list" onClick={() => exec('insertOrderedList')} />
        <ToolbarButton label="Link" title="Insert link" onClick={addLink} />
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <ToolbarButton label="Undo" title="Undo" onClick={() => exec('undo')} />
        <ToolbarButton label="Redo" title="Redo" onClick={() => exec('redo')} />
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Email body"
        contentEditable={!disabled}
        suppressContentEditableWarning
        className="min-h-[220px] max-h-[480px] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none prose prose-sm max-w-none"
        onInput={() => {
          if (ref.current) onChange(ref.current.innerHTML)
        }}
      />
    </div>
  )
}
