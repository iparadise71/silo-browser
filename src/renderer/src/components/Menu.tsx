import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export type MenuItem =
  | {
      kind: 'item'
      label: string
      icon?: ReactNode
      hint?: string
      danger?: boolean
      disabled?: boolean
      dot?: string
      onSelect: () => void
    }
  | { kind: 'sep' }
  | { kind: 'label'; label: string }
  | { kind: 'note'; label: string }

export interface MenuState {
  items: MenuItem[]
  /** Botón al que se ancla; si es null se usa x/y del clic. */
  anchor: HTMLElement | null
  x: number
  y: number
  /** Abre hacia arriba (barra de selección). */
  up?: boolean
}

export function Menu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const W = window.innerWidth
    const H = window.innerHeight
    const { width: mw, height: mh } = el.getBoundingClientRect()
    let left = state.x
    let top = state.y
    if (state.anchor) {
      const r = state.anchor.getBoundingClientRect()
      left = state.up ? r.left : r.right - mw
      top = state.up ? r.top - mh - 6 : r.bottom + 6
      if (!state.up && top + mh > H - 8) top = r.top - mh - 6
    }
    setPos({ left: Math.max(8, Math.min(left, W - mw - 8)), top: Math.max(8, Math.min(top, H - mh - 8)) })
  }, [state])

  useEffect(() => {
    const el = ref.current
    el?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
    const onDown = (e: MouseEvent) => {
      if (!el?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const items = [...(el?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="menu"
      role="menu"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, position: 'fixed' }}
    >
      {state.items.map((it, i) => {
        if (it.kind === 'sep') return <hr key={i} />
        if (it.kind === 'label')
          return (
            <p key={i} className="lbl">
              {it.label}
            </p>
          )
        if (it.kind === 'note')
          return (
            <p key={i} className="why">
              {it.label}
            </p>
          )
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={it.danger ? 'del' : undefined}
            disabled={it.disabled}
            onClick={() => {
              onClose()
              it.onSelect()
            }}
          >
            {it.dot !== undefined ? (
              <span
                className="gd"
                style={
                  (it.dot
                    ? { '--c': it.dot }
                    : {
                        '--c': 'transparent',
                        boxShadow: 'inset 0 0 0 1.5px var(--faint)'
                      }) as unknown as CSSProperties
                }
              />
            ) : (
              it.icon
            )}
            {it.label}
            {it.hint && <span className="k">{it.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
