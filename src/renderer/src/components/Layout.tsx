import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { colorHex } from '@shared/constants'
import type { ActivityEntry, BrowserState, Group, Profile } from '@shared/model'
import type { SortKey, StatusFilter } from '@shared/filter'
import * as I from '@/lib/icons'
import { clock, dayDiff, plural } from '@/lib/format'
import { modKey } from '@/lib/api'
import { Avatar } from './ProfileCard'

/* ---------- Barra superior ---------- */

export function TopBar({
  searchRef,
  ...props
}: {
  query: string
  onQuery: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  hasProfiles: boolean
  openCount: number
  total: number
  browsers: BrowserState | null
  onSettings: () => void
  onSearchKey: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  const sel = props.browsers?.selected
  return (
    <header className="top">
      <div className="brand">
        <I.Mark />
        <span>Silo Browser</span>
      </div>
      <label className="search" style={{ visibility: props.hasProfiles ? 'visible' : 'hidden' }}>
        <I.Search />
        <span className="sr">Buscar perfiles</span>
        <input
          ref={searchRef}
          type="search"
          placeholder="Buscar perfil, grupo o nota…"
          autoComplete="off"
          spellCheck={false}
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
          onKeyDown={props.onSearchKey}
        />
        <kbd>{modKey} K</kbd>
      </label>
      <div className="spacer" />
      {props.hasProfiles && (
        <span className="stats">
          <b>{props.openCount}</b> {props.openCount === 1 ? 'abierto' : 'abiertos'} · <b>{props.total}</b>{' '}
          perfiles
        </span>
      )}
      <button
        type="button"
        className={`chrome-pill ${sel ? '' : 'bad'}`}
        title={sel ? sel.path : 'Elegir navegador'}
        onClick={props.onSettings}
      >
        <i />
        <span>
          {sel
            ? `${sel.name.replace('Google ', '')}${sel.version ? ' ' + sel.version.split('.')[0] : ''}`
            : 'sin navegador'}
        </span>
      </button>
      <button type="button" className="ib" aria-label="Ajustes" title="Ajustes" onClick={props.onSettings}>
        <I.Gear />
      </button>
    </header>
  )
}

/* ---------- Barra lateral ---------- */

export function Sidebar(props: {
  profiles: Profile[]
  groups: Group[]
  groupId: string | null
  version: string
  onGroup: (id: string | null) => void
  onCreateGroup: (name: string) => Promise<boolean>
  onGroupMenu: (g: Group, e: React.MouseEvent) => void
  onDropProfiles: (groupId: string, ids: string[]) => void
  dragIds: () => string[]
  onSettings: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [dropOn, setDropOn] = useState<string | null>(null)
  const count = (id: string) => props.profiles.filter((p) => p.groupId === id).length
  return (
    <aside className="side" aria-label="Biblioteca">
      <button
        type="button"
        className="nav"
        aria-current={props.groupId === null}
        onClick={() => props.onGroup(null)}
      >
        <I.Library />
        <span>Todos los perfiles</span>
        <span className="c">{props.profiles.length}</span>
      </button>
      <h4>
        Grupos
        <button type="button" aria-label="Nuevo grupo" title="Nuevo grupo" onClick={() => setAdding(true)}>
          +
        </button>
      </h4>
      {props.groups.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`nav ${dropOn === g.id ? 'drop' : ''}`}
          aria-current={props.groupId === g.id}
          onClick={() => props.onGroup(g.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            props.onGroupMenu(g, e)
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('application/x-silo-profile')) return
            e.preventDefault()
            setDropOn(g.id)
          }}
          onDragLeave={() => setDropOn(null)}
          onDrop={(e) => {
            e.preventDefault()
            setDropOn(null)
            const id = e.dataTransfer.getData('application/x-silo-profile')
            const ids = props.dragIds()
            props.onDropProfiles(g.id, ids.includes(id) ? ids : [id])
          }}
        >
          <span className="gd" style={{ '--c': colorHex(g.color) } as CSSProperties} />
          <span>{g.name}</span>
          <span className="c">{count(g.id)}</span>
        </button>
      ))}
      {adding && (
        <NewGroupInput
          onDone={async (name) => {
            if (name && !(await props.onCreateGroup(name))) return
            setAdding(false)
          }}
        />
      )}
      {!props.groups.length && !adding && <p className="hint">Agrupa perfiles por cliente o equipo.</p>}
      <div className="side-foot">
        <button type="button" className="nav" onClick={props.onSettings}>
          <I.Gear size={16} />
          <span>Ajustes</span>
          <span className="c">{modKey === '⌘' ? '⌘,' : 'Ctrl+,'}</span>
        </button>
        <p className="ver">Silo Browser {props.version}</p>
      </div>
    </aside>
  )
}

function NewGroupInput({ onDone }: { onDone: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <input
      ref={ref}
      className="input"
      placeholder="Nombre del grupo"
      maxLength={24}
      aria-label="Nombre del grupo"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone('')
        if (e.key === 'Enter') onDone(e.currentTarget.value.trim())
      }}
      onBlur={(e) => onDone(e.currentTarget.value.trim())}
    />
  )
}

/* ---------- Cabecera de la lista ---------- */

export function MainHead(props: {
  title: string
  total: number
  openCount: number
  status: StatusFilter
  sort: SortKey
  view: 'grid' | 'list'
  closedCount: number
  onStatus: (s: StatusFilter) => void
  onSort: (s: SortKey) => void
  onView: (v: 'grid' | 'list') => void
  onCreate: () => void
  /** Solo con un grupo seleccionado: abre todos sus perfiles cerrados. */
  openGroup?: { closed: number; canLaunch: boolean; onOpen: () => void }
}) {
  const tab = (key: StatusFilter, label: string, n: number, color?: string) => (
    <button
      key={key}
      type="button"
      className="chip"
      aria-pressed={props.status === key}
      onClick={() => props.onStatus(key)}
    >
      {color && <i style={{ '--c': color } as CSSProperties} />}
      {label}
      <b>{n}</b>
    </button>
  )
  return (
    <>
      <div className="mhead">
        <h2>{props.title}</h2>
        <span className="meta">
          <b>{props.total}</b> total · <b>{props.openCount}</b>{' '}
          {props.openCount === 1 ? 'abierto' : 'abiertos'}
        </span>
        <div className="spacer" />
        <div className="seg" role="group" aria-label="Vista">
          <button
            type="button"
            aria-pressed={props.view === 'grid'}
            aria-label="Tarjetas"
            title="Tarjetas"
            onClick={() => props.onView('grid')}
          >
            <I.Grid />
          </button>
          <button
            type="button"
            aria-pressed={props.view === 'list'}
            aria-label="Lista"
            title="Lista"
            onClick={() => props.onView('list')}
          >
            <I.List />
          </button>
        </div>
        {props.openGroup && (
          <button
            type="button"
            className="btn"
            disabled={!props.openGroup.closed || !props.openGroup.canLaunch}
            title={
              !props.openGroup.canLaunch
                ? 'No hay navegador configurado'
                : props.openGroup.closed
                  ? `Abre los ${props.openGroup.closed} perfiles cerrados del grupo, cada uno con sus pestañas`
                  : 'Todos los perfiles del grupo ya están abiertos'
            }
            onClick={props.openGroup.onOpen}
          >
            <I.Play /> Abrir grupo
          </button>
        )}
        <button type="button" className="btn grad" onClick={props.onCreate}>
          <I.Plus /> Nuevo perfil <kbd>{modKey} N</kbd>
        </button>
      </div>
      <div className="chips">
        {tab('all', 'Todos', props.total)}
        {tab('open', 'Abiertos', props.openCount, 'var(--ok)')}
        {tab('closed', 'Cerrados', props.closedCount, 'var(--faint)')}
        <span className="spacer" />
        <select
          aria-label="Ordenar"
          value={props.sort}
          onChange={(e) => props.onSort(e.target.value as SortKey)}
        >
          <option value="recent">Recientes primero</option>
          <option value="name">Nombre A–Z</option>
        </select>
      </div>
    </>
  )
}

/* ---------- Primer uso ---------- */

export function Hero({ onCreate, profilesDir }: { onCreate: () => void; profilesDir: string }) {
  return (
    <div className="hero">
      <div className="hero-in">
        <div className="hero-mark">
          <I.Mark size={52} />
        </div>
        <h2>
          Una cuenta, <span>un Chrome aparte.</span>
        </h2>
        <p className="lead">
          Cada perfil guarda su propia sesión de Google, cookies, historial y extensiones. Ábrelos a la vez
          sin que se mezclen.
        </p>
        <div className="steps">
          <div className="step">
            <span className="n">01</span>
            <strong>Crea un perfil</strong>
            <span>Nombre, color, ícono y la página con la que abre.</span>
          </div>
          <div className="step">
            <span className="n">02</span>
            <strong>Ábrelo en Chrome</strong>
            <span>Silo Browser lanza tu Chrome con la carpeta de ese perfil.</span>
          </div>
          <div className="step">
            <span className="n">03</span>
            <strong>Inicia sesión una vez</strong>
            <span>La sesión queda guardada en su carpeta.</span>
          </div>
        </div>
        <button type="button" className="btn grad" onClick={onCreate}>
          <I.Plus /> Crear primer perfil <kbd>{modKey} N</kbd>
        </button>
        <span className="fine selectable">{profilesDir}</span>
      </div>
    </div>
  )
}

export function NoBrowserBanner({ onDownload, onPick }: { onDownload: () => void; onPick: () => void }) {
  return (
    <div className="banner" role="alert">
      <I.Warn />
      <p>
        <strong>No encontramos Chrome ni otro navegador Chromium.</strong>
        Puedes crear y editar perfiles; para abrirlos, elige un navegador.
      </p>
      <button type="button" className="btn sm" onClick={onDownload}>
        Descargar Chrome
      </button>
      <button type="button" className="btn sm grad" onClick={onPick}>
        Elegir ejecutable…
      </button>
    </div>
  )
}

/* ---------- Actividad ---------- */

export function ActivityPanel({
  entries,
  profiles,
  open,
  onToggle
}: {
  entries: ActivityEntry[]
  profiles: Profile[]
  open: boolean
  onToggle: () => void
}) {
  const today = entries.filter((e) => dayDiff(e.at) === 0).length
  const last = entries[0]
  const text = (e: ActivityEntry) => (e.profileName ? `${e.profileName}: ${e.detail}` : e.detail)
  return (
    <section className={`activity ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="act-bar"
        aria-expanded={open}
        aria-controls="act-list"
        onClick={onToggle}
      >
        <I.Pulse />
        <strong>Actividad</strong>
        <span className="pillc">{today} hoy</span>
        <span className="last">
          {last ? `${clock(last.at)} · ${text(last)}` : 'Sin actividad en esta sesión'}
        </span>
        <I.Chevron className="chev" />
      </button>
      <div className="act-list" id="act-list">
        {entries.length ? (
          entries.map((e) => {
            const p = profiles.find((x) => x.id === e.profileId)
            return (
              <div key={e.id} className="act-item">
                <time>{clock(e.at)}</time>
                {p ? <Avatar p={p} size="xs" /> : <span />}
                <span>
                  {e.profileName && <b>{e.profileName}</b>}
                  {e.profileName ? ': ' : ''}
                  <span style={e.kind === 'error' ? { color: 'var(--danger)' } : undefined}>{e.detail}</span>
                </span>
              </div>
            )
          })
        ) : (
          <div className="act-item">
            <time />
            <span />
            <span>Aquí aparecen aperturas, cierres y cambios de esta sesión.</span>
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------- Selección múltiple ---------- */

export function BatchBar(props: {
  count: number
  closed: number
  open: number
  canLaunch: boolean
  onOpen: () => void
  onStop: () => void
  onMove: (anchor: HTMLElement) => void
  onClear: () => void
}) {
  return (
    <div className="batch" role="toolbar" aria-label="Acciones para la selección">
      <strong>{plural(props.count, 'seleccionado', 'seleccionados')}</strong>
      <button
        type="button"
        className="btn sm grad"
        disabled={!props.closed || !props.canLaunch}
        onClick={props.onOpen}
      >
        <I.Play /> Abrir {props.closed || ''}
      </button>
      {props.open > 0 && (
        <button type="button" className="btn sm" onClick={props.onStop}>
          <I.Stop /> Detener {props.open}
        </button>
      )}
      <button type="button" className="btn sm" onClick={(e) => props.onMove(e.currentTarget)}>
        Mover a grupo
      </button>
      <button
        type="button"
        className="ib"
        aria-label="Quitar selección"
        title="Quitar selección (Esc)"
        onClick={props.onClear}
      >
        <I.Close />
      </button>
    </div>
  )
}

/* ---------- Aviso ---------- */

export interface ToastData {
  id: number
  text: string
  profile?: Pick<Profile, 'color' | 'emoji'>
  error?: boolean
}

export function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
      {toast &&
        (toast.profile ? (
          <Avatar p={toast.profile} size="xs" />
        ) : (
          <span className="ok" style={toast.error ? { background: 'var(--danger)' } : undefined}>
            {toast.error ? '!' : <I.Check />}
          </span>
        ))}
      <span>{toast?.text}</span>
    </div>
  )
}
