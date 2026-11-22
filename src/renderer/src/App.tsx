import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COLOR_IDS, colorHex } from '@shared/constants'
import type {
  ActivityEntry,
  AppInfo,
  BrowserState,
  Group,
  Profile,
  ProfileInput,
  Snapshot
} from '@shared/model'
import { filterProfiles, type SortKey, type StatusFilter } from '@shared/filter'
import { api, call, errorInfo, fileManager, isMac } from '@/lib/api'
import * as I from '@/lib/icons'
import { ProfileCard, ProfileRow, type ItemHandlers } from '@/components/ProfileCard'
import { ProfileDialog } from '@/components/ProfileDialog'
import { DeleteDialog } from '@/components/DeleteDialog'
import { Dialog } from '@/components/Dialog'
import { SettingsDialog, type ThemePref } from '@/components/SettingsDialog'
import { Menu, type MenuItem, type MenuState } from '@/components/Menu'
import {
  ActivityPanel,
  BatchBar,
  Hero,
  MainHead,
  NoBrowserBanner,
  Sidebar,
  Toast,
  TopBar,
  type ToastData
} from '@/components/Layout'

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; profile: Profile }
  | { type: 'delete'; profile: Profile }
  | { type: 'settings' }
  | { type: 'openMany'; profiles: Profile[]; label: string }
  | null

/** A partir de cuántos perfiles se pide confirmación antes de abrirlos todos: cada uno es un Chrome completo. */
const OPEN_MANY_CONFIRM = 8

const store = {
  get<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
    try {
      const v = localStorage.getItem(`silo.${key}`) as T | null
      return v && allowed.includes(v) ? v : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(`silo.${key}`, value)
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }
}

function applyTheme(t: ThemePref) {
  if (t === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export function App() {
  /* ---------- Datos ---------- */
  const [snap, setSnap] = useState<Snapshot>({ profiles: [], groups: [], running: [] })
  const [loaded, setLoaded] = useState(false)
  const [browsers, setBrowsers] = useState<BrowserState | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])

  /* ---------- Interfaz ---------- */
  const [groupId, setGroupId] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>(() => store.get('sort', 'recent', ['recent', 'name']))
  const [view, setView] = useState<'grid' | 'list'>(() => store.get('view', 'grid', ['grid', 'list']))
  const [theme, setTheme] = useState<ThemePref>(() =>
    store.get('theme', 'system', ['system', 'dark', 'light'])
  )
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [multi, setMulti] = useState<Set<string>>(new Set())
  const [opening, setOpening] = useState<Set<string>>(new Set())
  const [stopping, setStopping] = useState<Set<string>>(new Set())
  const [actOpen, setActOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const running = useMemo(() => new Set(snap.running), [snap.running])
  const canLaunch = !!browsers?.selected
  const groupOf = useCallback((id: string | null) => snap.groups.find((g) => g.id === id), [snap.groups])

  useEffect(() => applyTheme(theme), [theme])

  const notify = useCallback((text: string, opts: Partial<Omit<ToastData, 'id' | 'text'>> = {}) => {
    clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text, ...opts })
    toastTimer.current = setTimeout(() => setToast(null), opts.error ? 5000 : 3200)
  }, [])
  const fail = useCallback((err: unknown) => notify(errorInfo(err).message, { error: true }), [notify])

  /* ---------- Carga y eventos de main ---------- */
  useEffect(() => {
    void Promise.all([
      call('profiles:snapshot'),
      call('browsers:state'),
      call('app:info'),
      call('activity:list')
    ]).then(([s, b, i, a]) => {
      setSnap(s)
      setBrowsers(b)
      setInfo(i)
      setActivity(a)
      setLoaded(true)
    })
    const offs = [
      api.on('state:changed', (s) => {
        setSnap(s)
        // Si un perfil o grupo desaparece, se limpia la selección.
        const ids = new Set(s.profiles.map((p) => p.id))
        setSel((cur) => (cur && !ids.has(cur) ? null : cur))
        setMulti((m) =>
          m.size && [...m].some((id) => !ids.has(id)) ? new Set([...m].filter((id) => ids.has(id))) : m
        )
        setGroupId((g) => (g && !s.groups.some((x) => x.id === g) ? null : g))
      }),
      api.on('activity:added', (e) => setActivity((prev) => [e, ...prev].slice(0, 200))),
      api.on('menu:new-profile', () => setDialog((d) => d ?? { type: 'create' })),
      api.on('menu:settings', () => setDialog((d) => d ?? { type: 'settings' }))
    ]
    return () => offs.forEach((off) => off())
  }, [])

  const visible = useMemo(
    () => filterProfiles(snap.profiles, snap.groups, running, { groupId, status, query, sort }),
    [snap, running, groupId, status, query, sort]
  )
  const inGroup = useMemo(
    () => snap.profiles.filter((p) => !groupId || p.groupId === groupId),
    [snap.profiles, groupId]
  )

  /* ---------- Acciones ---------- */
  const openProfile = useCallback(
    async (p: Profile, quiet = false) => {
      if (opening.has(p.id)) return
      if (!canLaunch) {
        notify('Elige un navegador en Ajustes antes de abrir perfiles.', { error: true })
        return
      }
      setOpening((s) => new Set(s).add(p.id))
      try {
        const { mode } = await call('profiles:open', p.id)
        if (!quiet)
          notify(mode === 'window' ? `Nueva ventana de ${p.name}` : `${p.name} abierto`, { profile: p })
      } catch (err) {
        fail(err)
      } finally {
        setOpening((s) => {
          const n = new Set(s)
          n.delete(p.id)
          return n
        })
      }
    },
    [opening, canLaunch, notify, fail]
  )

  /** Abre los perfiles cerrados de la lista, escalonados para no lanzar todos los Chrome a la vez. */
  const openMany = useCallback(
    (list: Profile[]) => {
      const targets = list.filter((p) => !running.has(p.id))
      targets.forEach((p, i) => setTimeout(() => void openProfile(p, true), i * 250))
      if (targets.length)
        notify(`Abriendo ${targets.length === 1 ? targets[0]!.name : `${targets.length} perfiles`}`)
    },
    [running, openProfile, notify]
  )

  /** Como openMany, pero confirma antes si son muchos. `label` nombra el conjunto («Clientes»). */
  const requestOpenMany = useCallback(
    (list: Profile[], label: string) => {
      if (!canLaunch) {
        notify('Elige un navegador en Ajustes antes de abrir perfiles.', { error: true })
        return
      }
      const targets = list.filter((p) => !running.has(p.id))
      if (targets.length > OPEN_MANY_CONFIRM) setDialog({ type: 'openMany', profiles: targets, label })
      else openMany(targets)
    },
    [canLaunch, running, openMany, notify]
  )

  /** Detiene por completo el Chrome de uno o varios perfiles (todas sus ventanas). */
  const stopProfiles = useCallback(
    async (list: Profile[]) => {
      const targets = list.filter((p) => running.has(p.id) && !stopping.has(p.id))
      if (!targets.length) return
      const ids = targets.map((p) => p.id)
      setStopping((s) => new Set([...s, ...ids]))
      try {
        const r = await call('profiles:stop', ids)
        const one = targets.length === 1 ? targets[0] : undefined
        if (r.failed.length) notify(`No se pudo detener: ${r.failed.join(', ')}`, { error: true })
        else if (r.forced)
          notify(
            one
              ? `${one.name} no respondía: se forzó el cierre`
              : `${r.closed} perfiles detenidos (${r.forced} forzados)`,
            { profile: one }
          )
        else notify(one ? `${one.name} detenido` : `${r.closed} perfiles detenidos`, { profile: one })
      } catch (err) {
        fail(err)
      } finally {
        setStopping((s) => {
          const n = new Set(s)
          ids.forEach((id) => n.delete(id))
          return n
        })
      }
    },
    [running, stopping, notify, fail]
  )

  const moveTo = useCallback(
    async (ids: string[], gid: string | null) => {
      try {
        await call('profiles:move', ids, gid)
        setMulti(new Set())
        const g = groupOf(gid)
        notify(
          `${ids.length > 1 ? `${ids.length} perfiles movidos` : 'Movido'} a ${g ? g.name : 'sin grupo'}`
        )
      } catch (err) {
        fail(err)
      }
    },
    [groupOf, notify, fail]
  )

  const duplicate = useCallback(
    async (p: Profile) => {
      try {
        const c = await call('profiles:duplicate', p.id)
        setSel(c.id)
        notify('Duplicado sin sesión: se copió la configuración, no las cookies', { profile: c })
      } catch (err) {
        fail(err)
      }
    },
    [notify, fail]
  )

  const askDelete = useCallback(
    (p: Profile) => {
      if (running.has(p.id)) notify(`Detén ${p.name} antes de eliminarlo`, { profile: p })
      else setDialog({ type: 'delete', profile: p })
    },
    [running, notify]
  )

  const moveItems = (current: string | null | undefined, ids: string[]): MenuItem[] => [
    ...snap.groups.map((g): MenuItem => ({
      kind: 'item',
      label: g.name,
      dot: colorHex(g.color),
      disabled: current === g.id,
      hint: current === g.id ? 'actual' : undefined,
      onSelect: () => void moveTo(ids, g.id)
    })),
    {
      kind: 'item',
      label: 'Sin grupo',
      dot: '',
      disabled: current === null,
      onSelect: () => void moveTo(ids, null)
    }
  ]

  const profileMenu = (p: Profile, anchor: HTMLElement | null, x = 0, y = 0) => {
    setSel(p.id)
    setMulti(new Set())
    const open = running.has(p.id)
    const items: MenuItem[] = [
      {
        kind: 'item',
        label: open ? 'Nueva ventana' : 'Abrir',
        icon: open ? <I.Window /> : <I.Play />,
        hint: '↵',
        disabled: !canLaunch,
        onSelect: () => void openProfile(p)
      },
      ...(open
        ? ([
            {
              kind: 'item',
              label: 'Detener perfil',
              icon: <I.Stop />,
              hint: 'S',
              disabled: stopping.has(p.id),
              onSelect: () => void stopProfiles([p])
            }
          ] as MenuItem[])
        : []),
      {
        kind: 'item',
        label: 'Editar…',
        icon: <I.Edit />,
        hint: 'E',
        onSelect: () => setDialog({ type: 'edit', profile: p })
      },
      { kind: 'item', label: 'Duplicar sin sesión', icon: <I.Copy />, onSelect: () => void duplicate(p) },
      {
        kind: 'item',
        label: `Mostrar carpeta en ${fileManager}`,
        icon: <I.Folder />,
        onSelect: () => void call('profiles:reveal', p.id).catch(fail)
      },
      ...(snap.groups.length
        ? ([
            { kind: 'sep' },
            { kind: 'label', label: 'Mover a' },
            ...moveItems(p.groupId, [p.id])
          ] as MenuItem[])
        : []),
      { kind: 'sep' },
      {
        kind: 'item',
        label: 'Eliminar…',
        icon: <I.Trash />,
        hint: '⌫',
        danger: true,
        disabled: open,
        onSelect: () => askDelete(p)
      },
      ...(open ? ([{ kind: 'note', label: 'Detén el perfil para eliminarlo.' }] as MenuItem[]) : [])
    ]
    setMenu({ items, anchor, x, y })
  }

  const groupMenu = (g: Group, e: React.MouseEvent) => {
    const members = snap.profiles.filter((p) => p.groupId === g.id)
    const closed = members.filter((p) => !running.has(p.id))
    const open = members.filter((p) => running.has(p.id))
    setMenu({
      anchor: null,
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          kind: 'item',
          label: closed.length > 1 ? `Abrir los ${closed.length} cerrados` : 'Abrir el grupo',
          icon: <I.Play />,
          disabled: !closed.length || !canLaunch,
          hint: !members.length ? 'vacío' : !closed.length ? 'todos abiertos' : undefined,
          onSelect: () => requestOpenMany(closed, g.name)
        },
        {
          kind: 'item',
          label: open.length > 1 ? `Detener los ${open.length} abiertos` : 'Detener el grupo',
          icon: <I.Stop />,
          disabled: !open.length,
          onSelect: () => void stopProfiles(open)
        },
        { kind: 'sep' },
        {
          kind: 'item',
          label: `Eliminar grupo «${g.name}»`,
          icon: <I.Trash />,
          danger: true,
          onSelect: () =>
            void call('groups:remove', g.id)
              .then(() => notify(`Grupo ${g.name} eliminado; sus perfiles quedaron sin grupo`))
              .catch(fail)
        }
      ]
    })
  }

  const select = (p: Profile, e: React.MouseEvent) => {
    if (e.shiftKey && sel) {
      const a = visible.findIndex((x) => x.id === sel)
      const b = visible.findIndex((x) => x.id === p.id)
      setMulti(new Set(visible.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id)))
      return
    }
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(multi.size ? multi : sel ? [sel] : [])
      if (next.has(p.id)) next.delete(p.id)
      else next.add(p.id)
      if (next.size < 2) {
        setSel([...next][0] ?? null)
        setMulti(new Set())
      } else {
        setSel(p.id)
        setMulti(next)
      }
      return
    }
    setMulti(new Set())
    setSel(p.id)
  }

  const handlersFor = (p: Profile): ItemHandlers => ({
    onSelect: (e) => select(p, e),
    onOpen: () => void openProfile(p),
    onStop: () => void stopProfiles([p]),
    onMenu: (anchor, e) => profileMenu(p, anchor, e?.clientX, e?.clientY)
  })

  const saveProfile = async (input: ProfileInput, andOpen: boolean) => {
    const editing = dialog?.type === 'edit' ? dialog.profile : null
    try {
      const p = editing
        ? await call('profiles:update', editing.id, input)
        : await call('profiles:create', input)
      setDialog(null)
      setSel(p.id)
      setMulti(new Set())
      setQuery('')
      if (groupId && p.groupId !== groupId) setGroupId(null)
      if (status !== 'all') setStatus('all')
      if (andOpen) void openProfile(p)
      else notify(editing ? 'Cambios guardados' : `${p.name} creado`, { profile: p })
      return null
    } catch (err) {
      const { code, message } = errorInfo(err)
      const field = /url|pestañas/i.test(message)
        ? 'url'
        : code === 'DUPLICATE_NAME' || code === 'VALIDATION'
          ? 'name'
          : null
      return { field, message } as const
    }
  }

  /* ---------- Teclado ---------- */
  const columns = () => {
    if (view !== 'grid') return 1
    const grid = document.querySelector('.grid')
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 1
  }
  const moveSel = (delta: number) => {
    if (!visible.length) return
    const i = visible.findIndex((p) => p.id === sel)
    const next = visible[i < 0 ? 0 : Math.max(0, Math.min(visible.length - 1, i + delta))]!
    setSel(next.id)
    setMulti(new Set())
    requestAnimationFrame(() =>
      document.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' })
    )
  }

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined)
  const onKey = (e: KeyboardEvent) => {
    if (dialog || menu) return
    const mod = e.metaKey || e.ctrlKey
    const k = e.key.toLowerCase()
    if (mod && (k === 'k' || k === 'f')) {
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
      return
    }
    const target = e.target instanceof Element ? e.target : null
    if (target?.closest('input, textarea, select')) return
    const p = snap.profiles.find((x) => x.id === sel)
    if (mod && k === 'a') {
      e.preventDefault()
      setMulti(new Set(visible.map((x) => x.id)))
      return
    }
    if (mod && k === ',') {
      e.preventDefault()
      setDialog({ type: 'settings' })
      return
    }
    if (mod || e.altKey) return
    const onButton = !!target?.closest('button')
    switch (e.key) {
      case 'Escape':
        if (multi.size) setMulti(new Set())
        else setSel(null)
        break
      case '/':
        e.preventDefault()
        searchRef.current?.focus()
        break
      case 'ArrowRight':
        e.preventDefault()
        moveSel(1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveSel(-1)
        break
      case 'ArrowDown':
        e.preventDefault()
        moveSel(columns())
        break
      case 'ArrowUp':
        e.preventDefault()
        moveSel(-columns())
        break
      case 'Enter':
        if (p && !onButton) {
          e.preventDefault()
          void openProfile(p)
        }
        break
      case 's':
      case 'S':
        if (p && running.has(p.id)) {
          e.preventDefault()
          void stopProfiles([p])
        }
        break
      case 'e':
      case 'E':
        if (p) {
          e.preventDefault()
          setDialog({ type: 'edit', profile: p })
        }
        break
      case 'Backspace':
      case 'Delete':
        if (p && !multi.size) {
          e.preventDefault()
          askDelete(p)
        }
        break
    }
  }
  useEffect(() => {
    keyRef.current = onKey
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  /* ---------- Render ---------- */
  const hasProfiles = snap.profiles.length > 0
  const openCount = snap.profiles.filter((p) => running.has(p.id)).length
  const multiClosed = [...multi].filter((id) => !running.has(id)).length
  const group = groupOf(groupId)
  const pickBrowser = () =>
    void call('browsers:pick')
      .then((b) => {
        if (b) {
          setBrowsers(b)
          notify(`Navegador: ${b.selected?.name ?? ''}`)
        }
      })
      .catch(fail)

  let body: React.ReactNode
  if (!loaded) body = null
  else if (!hasProfiles)
    body = <Hero onCreate={() => setDialog({ type: 'create' })} profilesDir={info?.profilesDir ?? ''} />
  else if (!visible.length)
    body = (
      <div className="nomatch">
        {query ? (
          <>
            <strong>Nada coincide con «{query}»</strong>
            Se busca en nombre, grupo, página de inicio y notas.
            <br />
            <br />
            <button type="button" className="btn sm" onClick={() => setQuery('')}>
              Limpiar búsqueda
            </button>
          </>
        ) : status === 'open' ? (
          <>
            <strong>Ningún perfil abierto</strong>Cuando abras uno, aparece aquí.
          </>
        ) : status === 'closed' ? (
          <>
            <strong>Todos están abiertos</strong>Los perfiles cerrados aparecen aquí.
          </>
        ) : (
          <>
            <strong>{group ? `«${group.name}» está vacío` : 'Sin resultados'}</strong>Arrastra perfiles hasta
            el grupo o usa «Mover a» en su menú.
          </>
        )}
      </div>
    )
  else {
    const stateFor = (p: Profile) => ({
      open: running.has(p.id),
      opening: opening.has(p.id),
      stopping: stopping.has(p.id),
      selected: sel === p.id && !multi.size,
      multi: multi.has(p.id),
      canLaunch
    })
    body =
      view === 'grid' ? (
        <div className="grid">
          {visible.map((p) => (
            <ProfileCard
              key={p.id}
              p={p}
              group={groupOf(p.groupId)}
              state={stateFor(p)}
              handlers={handlersFor(p)}
            />
          ))}
          {status === 'all' && !query && (
            <button type="button" className="addcard" onClick={() => setDialog({ type: 'create' })}>
              <span className="plus">+</span>
              Nuevo perfil{group ? ` en ${group.name}` : ''}
            </button>
          )}
        </div>
      ) : (
        <div className="list">
          {visible.map((p) => (
            <ProfileRow
              key={p.id}
              p={p}
              group={groupOf(p.groupId)}
              state={stateFor(p)}
              handlers={handlersFor(p)}
            />
          ))}
        </div>
      )
  }

  return (
    <div
      className={`win ${isMac ? 'mac' : ''} ${multi.size > 1 ? 'has-batch' : ''} ${actOpen ? 'act-open' : ''}`}
    >
      <TopBar
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        hasProfiles={hasProfiles}
        openCount={openCount}
        total={snap.profiles.length}
        browsers={browsers}
        onSettings={() => setDialog({ type: 'settings' })}
        onSearchKey={(e) => {
          if (e.key === 'Escape') {
            setQuery('')
            e.currentTarget.blur()
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.currentTarget.blur()
            moveSel(0)
          }
          if (e.key === 'Enter' && visible[0]) {
            setSel(visible[0].id)
            void openProfile(visible[0])
          }
        }}
      />
      <div className="body">
        <Sidebar
          profiles={snap.profiles}
          groups={snap.groups}
          groupId={groupId}
          version={info?.version ?? ''}
          onGroup={(id) => {
            setGroupId(id)
            setMulti(new Set())
          }}
          onCreateGroup={async (name) => {
            try {
              const g = await call('groups:create', name)
              setGroupId(g.id)
              notify(`Grupo ${g.name} creado. Arrastra perfiles hasta él.`)
              return true
            } catch (err) {
              fail(err)
              return false
            }
          }}
          onGroupMenu={groupMenu}
          onDropProfiles={(gid, ids) => void moveTo(ids, gid)}
          dragIds={() => [...multi]}
          onSettings={() => setDialog({ type: 'settings' })}
        />
        <div className="main">
          {hasProfiles && (
            <MainHead
              title={group ? group.name : 'Todos los perfiles'}
              total={inGroup.length}
              openCount={inGroup.filter((p) => running.has(p.id)).length}
              closedCount={inGroup.filter((p) => !running.has(p.id)).length}
              status={status}
              sort={sort}
              view={view}
              onStatus={setStatus}
              onSort={(s) => {
                setSort(s)
                store.set('sort', s)
              }}
              onView={(v) => {
                setView(v)
                store.set('view', v)
              }}
              onCreate={() => setDialog({ type: 'create' })}
              openGroup={
                group
                  ? {
                      closed: inGroup.filter((p) => !running.has(p.id)).length,
                      canLaunch,
                      onOpen: () => requestOpenMany(inGroup, group.name)
                    }
                  : undefined
              }
            />
          )}
          {loaded && !canLaunch && (
            <NoBrowserBanner
              onDownload={() => void call('app:downloadChrome').catch(fail)}
              onPick={pickBrowser}
            />
          )}
          <main
            className="content"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSel(null)
                setMulti(new Set())
              }
            }}
          >
            {body}
          </main>
          <ActivityPanel
            entries={activity}
            profiles={snap.profiles}
            open={actOpen}
            onToggle={() => setActOpen((v) => !v)}
          />
        </div>
      </div>

      {multi.size > 1 && (
        <BatchBar
          count={multi.size}
          closed={multiClosed}
          open={multi.size - multiClosed}
          canLaunch={canLaunch}
          onStop={() => {
            void stopProfiles(snap.profiles.filter((p) => multi.has(p.id)))
            setMulti(new Set())
          }}
          onOpen={() => {
            requestOpenMany(
              snap.profiles.filter((p) => multi.has(p.id)),
              'la selección'
            )
            setMulti(new Set())
          }}
          onMove={(anchor) =>
            snap.groups.length
              ? setMenu({
                  anchor,
                  x: 0,
                  y: 0,
                  up: true,
                  items: [
                    { kind: 'label', label: `Mover ${multi.size} perfiles a` },
                    ...moveItems(undefined, [...multi])
                  ]
                })
              : notify('Crea un grupo primero con + en la barra lateral')
          }
          onClear={() => setMulti(new Set())}
        />
      )}

      {menu && <Menu state={menu} onClose={() => setMenu(null)} />}

      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <ProfileDialog
          profile={dialog.type === 'edit' ? dialog.profile : null}
          groups={snap.groups}
          defaultGroupId={groupId}
          defaultColor={COLOR_IDS[snap.profiles.length % COLOR_IDS.length]!}
          profilesDir={info?.profilesDir ?? ''}
          canLaunch={canLaunch}
          onClose={() => setDialog(null)}
          onSave={saveProfile}
        />
      )}
      {dialog?.type === 'delete' && (
        <DeleteDialog
          profile={dialog.profile}
          onClose={() => setDialog(null)}
          onConfirm={async (wipe) => {
            const p = dialog.profile
            try {
              await call('profiles:remove', p.id, { wipeData: wipe })
              setDialog(null)
              notify(
                wipe
                  ? `${p.name} eliminado y su carpeta borrada`
                  : `${p.name} eliminado; la carpeta se conservó`
              )
            } catch (err) {
              setDialog(null)
              fail(err)
            }
          }}
        />
      )}
      {dialog?.type === 'openMany' && (
        <Dialog
          title={`¿Abrir ${dialog.profiles.length} perfiles?`}
          role="alertdialog"
          onClose={() => setDialog(null)}
          as="form"
          initialFocus=".d-foot .btn.grad"
          onSubmit={() => {
            openMany(dialog.profiles)
            setDialog(null)
          }}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDialog(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn grad">
                <I.Play /> Abrir {dialog.profiles.length}
              </button>
            </>
          }
        >
          <p style={{ color: 'var(--muted)' }}>
            Se abrirá un Chrome por cada perfil cerrado de {dialog.label}, cada uno con sus pestañas de
            inicio. Con tantos a la vez el equipo puede ir lento unos segundos.
          </p>
        </Dialog>
      )}
      {dialog?.type === 'settings' && (
        <SettingsDialog
          browsers={browsers}
          info={info}
          theme={theme}
          onTheme={(t) => {
            setTheme(t)
            store.set('theme', t)
          }}
          onClose={() => setDialog(null)}
          onSelect={(path) =>
            void call('browsers:select', path)
              .then((b) => {
                setBrowsers(b)
                notify(`Navegador: ${b.selected?.name ?? ''}`)
              })
              .catch(fail)
          }
          onPick={pickBrowser}
          onRefresh={() =>
            void call('browsers:state', true)
              .then((b) => {
                setBrowsers(b)
                notify('Navegadores detectados de nuevo')
              })
              .catch(fail)
          }
          onRevealData={() => void call('app:revealData').catch(fail)}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
