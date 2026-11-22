import type { CSSProperties, MouseEvent } from 'react'
import { colorHex } from '@shared/constants'
import type { Group, Profile } from '@shared/model'
import { tabsLabel } from '@shared/filter'
import * as I from '@/lib/icons'
import { since, when } from '@/lib/format'

export interface ItemState {
  open: boolean
  opening: boolean
  stopping: boolean
  selected: boolean
  multi: boolean
  canLaunch: boolean
}

export interface ItemHandlers {
  onSelect: (e: MouseEvent) => void
  onOpen: () => void
  onStop: () => void
  onMenu: (anchor: HTMLElement | null, e?: MouseEvent) => void
}

const cssVar = (name: string, value: string) => ({ [name]: value }) as CSSProperties

export function Avatar({
  p,
  size = '',
  multi = false
}: {
  p: Pick<Profile, 'color' | 'emoji'>
  size?: string
  multi?: boolean
}) {
  return (
    <div className={`av ${size}`} style={cssVar('--c', colorHex(p.color))}>
      {p.emoji}
      {multi && (
        <span className="ck">
          <I.Check />
        </span>
      )}
    </div>
  )
}

export function GroupLabel({ group }: { group: Group | undefined }) {
  if (!group) return <span className="grp">sin grupo</span>
  return (
    <span className="grp" style={cssVar('--g', colorHex(group.color))}>
      <i />
      {group.name}
    </span>
  )
}

function StatusPill({ open, opening, stopping }: { open: boolean; opening: boolean; stopping: boolean }) {
  if (stopping)
    return (
      <span className="pill busy">
        <span className="spin" />
        deteniendo
      </span>
    )
  if (opening)
    return (
      <span className="pill busy">
        <span className="spin" />
        abriendo
      </span>
    )
  return open ? (
    <span className="pill on">
      <i />
      abierto
    </span>
  ) : (
    <span className="pill">cerrado</span>
  )
}

function StartWell({ p }: { p: Profile }) {
  return (
    <div
      className="well"
      title={
        p.tabs.length > 1
          ? `Pestañas con las que abre este perfil:\n${p.tabs.join('\n')}`
          : 'Página con la que abre este perfil'
      }
    >
      <span className="ico">
        <I.Globe />
      </span>
      <span className="em">{tabsLabel(p.tabs)}</span>
      <span className="tag">{p.tabs.length > 1 ? `${p.tabs.length} pestañas` : 'inicio'}</span>
    </div>
  )
}

function lastLabel(p: Profile, open: boolean) {
  if (open) return `abierto ${since(p.lastOpenedAt)}`
  return p.lastOpenedAt ? `último uso ${when(p.lastOpenedAt)}` : 'nunca abierto'
}

function Actions({ p, s, h, compact }: { p: Profile; s: ItemState; h: ItemHandlers; compact?: boolean }) {
  const disabled = !s.canLaunch || s.opening || s.stopping
  const title = !s.canLaunch
    ? 'No hay navegador configurado'
    : s.open
      ? 'Abre otra ventana de este perfil'
      : p.tabs.length > 1
        ? `Abrir con ${p.tabs.length} pestañas`
        : `Abrir en ${tabsLabel(p.tabs)}`
  return (
    <>
      <button
        type="button"
        className={`launch ${s.open ? 'run' : ''}`}
        disabled={disabled}
        title={title}
        onClick={(e) => {
          e.stopPropagation()
          h.onOpen()
        }}
      >
        {s.opening ? (
          <>
            <span className="spin" />
            Abriendo
          </>
        ) : s.open ? (
          <>
            <I.Window />
            {compact ? 'Ventana' : 'Nueva ventana'}
          </>
        ) : (
          <>
            <I.Play />
            Abrir
          </>
        )}
      </button>
      {s.open && (
        <button
          type="button"
          className="sq stop"
          disabled={s.stopping}
          aria-label={`Detener ${p.name}`}
          title="Detener el perfil: cierra todas sus ventanas de Chrome"
          onClick={(e) => {
            e.stopPropagation()
            h.onStop()
          }}
        >
          {s.stopping ? <span className="spin" /> : <I.Stop />}
        </button>
      )}
      <button
        type="button"
        className="sq"
        aria-label={`Más acciones para ${p.name}`}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation()
          h.onMenu(e.currentTarget)
        }}
      >
        <I.More />
      </button>
    </>
  )
}

interface ItemProps {
  p: Profile
  group: Group | undefined
  state: ItemState
  handlers: ItemHandlers
  preview?: boolean
}

function rootProps(p: Profile, s: ItemState, h: ItemHandlers, preview?: boolean) {
  if (preview) return { style: cssVar('--c', colorHex(p.color)) }
  return {
    'data-id': p.id,
    style: cssVar('--c', colorHex(p.color)),
    'aria-current': s.selected,
    draggable: true,
    onDragStart: (e: React.DragEvent) => e.dataTransfer.setData('application/x-silo-profile', p.id),
    onClick: h.onSelect,
    onDoubleClick: (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('button') && !e.metaKey && !e.ctrlKey && !e.shiftKey) h.onOpen()
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      h.onMenu(null, e)
    }
  }
}

export function ProfileCard({ p, group, state: s, handlers: h, preview }: ItemProps) {
  return (
    <article
      className={`card ${s.open ? 'run' : ''} ${s.multi ? 'multi' : ''}`}
      {...rootProps(p, s, h, preview)}
    >
      <div className="c-head">
        <Avatar p={p} multi={s.multi} />
        <div className="c-title">
          <div className="nm">{p.name || 'Nombre del perfil'}</div>
          <GroupLabel group={group} />
        </div>
        <StatusPill open={s.open} opening={s.opening} stopping={s.stopping} />
      </div>
      <StartWell p={p} />
      <div className="c-meta">
        <I.Clock />
        <span>{lastLabel(p, s.open)}</span>
      </div>
      {p.notes ? (
        <div className="c-notes" title={p.notes}>
          {p.notes}
        </div>
      ) : null}
      <div className="c-foot">
        <Actions p={p} s={s} h={h} />
      </div>
    </article>
  )
}

export function ProfileRow({ p, group, state: s, handlers: h }: ItemProps) {
  return (
    <div
      className={`lrow ${s.open ? 'run' : ''} ${s.multi ? 'multi' : ''}`}
      title={p.notes}
      {...rootProps(p, s, h)}
    >
      <Avatar p={p} size="sm" multi={s.multi} />
      <div style={{ minWidth: 0 }}>
        <div className="nm">{p.name}</div>
        <GroupLabel group={group} />
      </div>
      <StartWell p={p} />
      <StatusPill open={s.open} opening={s.opening} stopping={s.stopping} />
      <span className="when">{s.open ? since(p.lastOpenedAt) : when(p.lastOpenedAt)}</span>
      <div className="acts">
        <Actions p={p} s={s} h={h} compact />
      </div>
    </div>
  )
}
