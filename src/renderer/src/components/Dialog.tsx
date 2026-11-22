import { useEffect, useRef, type ReactNode } from 'react'
import * as I from '@/lib/icons'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
  role?: 'dialog' | 'alertdialog'
  /** Selector del elemento que recibe el foco al abrir. */
  initialFocus?: string
  aside?: ReactNode
  as?: 'div' | 'form'
  onSubmit?: () => void
}

/** Diálogo modal: Esc y clic en el fondo cierran, el foco vuelve a donde estaba. */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  className = '',
  role = 'dialog',
  initialFocus,
  aside,
  as = 'div',
  onSubmit
}: DialogProps) {
  const ref = useRef<HTMLDivElement & HTMLFormElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    const target = (initialFocus && el?.querySelector<HTMLElement>(initialFocus)) || el
    target?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab' && el) {
        const items = [
          ...el.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ]
        if (!items.length) return
        const first = items[0]!
        const last = items[items.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  }, [initialFocus])

  const Tag = as
  const body = (
    <>
      <div className="d-head">
        <h2 id="dlg-title">{title}</h2>
        <button type="button" className="ib" aria-label="Cerrar" onClick={onClose}>
          <I.Close />
        </button>
      </div>
      <div className="d-body">{children}</div>
      {footer && <div className="d-foot">{footer}</div>}
    </>
  )

  return (
    <div className="layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Tag
        ref={ref}
        className={`dialog ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby="dlg-title"
        tabIndex={-1}
        noValidate={as === 'form' ? true : undefined}
        onSubmit={
          as === 'form'
            ? (e: React.FormEvent) => {
                e.preventDefault()
                onSubmit?.()
              }
            : undefined
        }
      >
        {aside ? (
          <>
            {aside}
            <div className="d-main">{body}</div>
          </>
        ) : (
          body
        )}
      </Tag>
    </div>
  )
}
