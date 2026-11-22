import { useState, type CSSProperties } from 'react'
import { COLORS, EMOJIS, MAX_TABS, TAB_PRESETS, colorHex, normalizeTabUrl } from '@shared/constants'
import { hostOf } from '@shared/filter'
import type { ColorId, Group, Profile, ProfileInput } from '@shared/model'
import { Dialog } from './Dialog'
import { ProfileCard } from './ProfileCard'
import * as I from '@/lib/icons'
import { modKey } from '@/lib/api'

interface Props {
  profile: Profile | null
  groups: Group[]
  defaultGroupId: string | null
  defaultColor: ColorId
  profilesDir: string
  canLaunch: boolean
  onClose: () => void
  /** Devuelve un mensaje de error para el campo nombre, o null si se guardó. */
  onSave: (
    input: ProfileInput,
    andOpen: boolean
  ) => Promise<{ field: 'name' | 'url' | null; message: string } | null>
}

export function ProfileDialog({
  profile,
  groups,
  defaultGroupId,
  defaultColor,
  profilesDir,
  canLaunch,
  onClose,
  onSave
}: Props) {
  const editing = !!profile
  const [name, setName] = useState(profile?.name ?? '')
  const [color, setColor] = useState<ColorId>(profile?.color ?? defaultColor)
  const [emoji, setEmoji] = useState(profile?.emoji ?? '💼')
  const [groupId, setGroupId] = useState<string | null>(profile ? profile.groupId : defaultGroupId)
  const [tabs, setTabs] = useState<string[]>(profile?.tabs ?? [])
  /** URL escrita en el campo y aún no añadida a la lista. */
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState(profile?.notes ?? '')
  const [error, setError] = useState<{ field: 'name' | 'url' | null; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const full = tabs.length >= MAX_TABS

  /** Añade la URL del campo a la lista. Devuelve la lista resultante, o null si la URL no vale. */
  const addUrl = (): string[] | null => {
    if (!url.trim()) return tabs
    const clean = normalizeTabUrl(url)
    if (!clean) {
      setError({ field: 'url', message: 'URL no válida. Ejemplo: https://ads.google.com' })
      return null
    }
    if (full) {
      setError({ field: 'url', message: `Máximo ${MAX_TABS} pestañas.` })
      return null
    }
    const next = tabs.includes(clean) ? tabs : [...tabs, clean]
    setTabs(next)
    setUrl('')
    setError(null)
    return next
  }
  const moveTab = (i: number, delta: number) =>
    setTabs((t) => {
      const next = [...t]
      const [item] = next.splice(i, 1)
      next.splice(i + delta, 0, item!)
      return next
    })

  const submit = async (andOpen: boolean) => {
    if (busy) return
    if (!name.trim()) return setError({ field: 'name', message: 'Escribe un nombre.' })
    // Una URL escrita y sin añadir también cuenta: nadie espera perderla al guardar.
    const finalTabs = addUrl()
    if (!finalTabs) return
    const input: ProfileInput = { name, color, emoji, groupId, notes, tabs: finalTabs }
    setBusy(true)
    const res = await onSave(input, andOpen)
    setBusy(false)
    if (res) setError(res)
  }

  const preview: Profile = {
    id: profile?.id ?? 'preview',
    name: name.trim(),
    color,
    emoji,
    notes: notes.trim(),
    groupId,
    tabs,
    createdAt: profile?.createdAt ?? new Date().toISOString(),
    lastOpenedAt: profile?.lastOpenedAt ?? null
  }
  const folder = `${profilesDir}/${profile?.id ?? '<id>'}`

  return (
    <Dialog
      title={editing ? 'Editar perfil' : 'Nuevo perfil'}
      onClose={onClose}
      className="xl"
      as="form"
      onSubmit={() => void submit(false)}
      initialFocus="#f-name"
      aside={
        <aside className="d-pv" style={{ '--c': colorHex(color) } as CSSProperties}>
          <span className="lbl">Vista previa</span>
          <ProfileCard
            p={preview}
            group={groups.find((g) => g.id === groupId)}
            preview
            state={{
              open: false,
              opening: false,
              stopping: false,
              selected: false,
              multi: false,
              canLaunch: true
            }}
            handlers={{
              onSelect: () => undefined,
              onOpen: () => undefined,
              onStop: () => undefined,
              onMenu: () => undefined
            }}
          />
          <p className="note">
            {editing ? 'Carpeta del perfil' : 'Se creará en'}
            <br />
            <span className="mono selectable">{folder}</span>
          </p>
        </aside>
      }
      footer={
        editing ? (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn grad" disabled={busy}>
              Guardar cambios
            </button>
          </>
        ) : (
          <>
            <span className="left">
              <kbd>{modKey} ↵</kbd> crear y abrir
            </span>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={busy}>
              Crear
            </button>
            <button
              type="button"
              className="btn grad"
              disabled={busy || !canLaunch}
              title={canLaunch ? undefined : 'No hay navegador configurado'}
              onClick={() => void submit(true)}
            >
              <I.Play /> Crear y abrir
            </button>
          </>
        )
      }
    >
      <div
        className="contents"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !editing && canLaunch) {
            e.preventDefault()
            void submit(true)
          }
        }}
        style={{ display: 'contents' }}
      >
        <div className="two">
          <div className="field">
            <label htmlFor="f-name">Nombre</label>
            <input
              id="f-name"
              className="input"
              value={name}
              maxLength={40}
              autoComplete="off"
              placeholder="Ej.: Cliente Oeste"
              aria-invalid={error?.field === 'name'}
              aria-describedby="f-name-err"
              onChange={(e) => {
                setName(e.target.value)
                if (error?.field === 'name') setError(null)
              }}
            />
            {error && error.field !== 'url' && (
              <p className="err" id="f-name-err">
                {error.message}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="f-group">
              Grupo <span className="opt">opcional</span>
            </label>
            <select
              id="f-group"
              className="input"
              value={groupId ?? ''}
              onChange={(e) => setGroupId(e.target.value || null)}
            >
              <option value="">Sin grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="fl" id="l-color">
            Color
          </span>
          <div className="swatches" role="radiogroup" aria-labelledby="l-color">
            {COLORS.map((c) => (
              <label key={c.id} title={c.name}>
                <input
                  type="radio"
                  name="color"
                  checked={color === c.id}
                  aria-label={c.name}
                  onChange={() => setColor(c.id)}
                />
                <span style={{ '--c': c.hex } as CSSProperties} />
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="fl" id="l-emoji">
            Ícono
          </span>
          <div className="emojis" role="radiogroup" aria-labelledby="l-emoji">
            {EMOJIS.map((e) => (
              <label key={e}>
                <input
                  type="radio"
                  name="emoji"
                  checked={emoji === e}
                  aria-label={e}
                  onChange={() => setEmoji(e)}
                />
                <span>{e}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-url">
            Pestañas de inicio{' '}
            <span className="opt">
              {tabs.length
                ? `${tabs.length} de ${MAX_TABS}, se abren en este orden`
                : 'sin ninguna abre una nueva pestaña'}
            </span>
          </label>
          {tabs.length > 0 && (
            <ol className="tabs">
              {tabs.map((t, i) => (
                <li key={t}>
                  <span className="n">{i + 1}</span>
                  <span className="u" title={t}>
                    {hostOf(t)}
                  </span>
                  <button
                    type="button"
                    className="ib"
                    disabled={i === 0}
                    aria-label={`Subir ${hostOf(t)}`}
                    title="Subir"
                    onClick={() => moveTab(i, -1)}
                  >
                    <I.Chevron />
                  </button>
                  <button
                    type="button"
                    className="ib down"
                    disabled={i === tabs.length - 1}
                    aria-label={`Bajar ${hostOf(t)}`}
                    title="Bajar"
                    onClick={() => moveTab(i, 1)}
                  >
                    <I.Chevron />
                  </button>
                  <button
                    type="button"
                    className="ib"
                    aria-label={`Quitar ${hostOf(t)}`}
                    title="Quitar"
                    onClick={() => setTabs((list) => list.filter((x) => x !== t))}
                  >
                    <I.Close size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="tab-add">
            <input
              id="f-url"
              className="input"
              type="text"
              inputMode="url"
              value={url}
              disabled={full}
              placeholder={full ? `Máximo ${MAX_TABS} pestañas` : 'https://'}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error?.field === 'url'}
              aria-describedby="f-url-err"
              onChange={(e) => {
                setUrl(e.target.value)
                if (error?.field === 'url') setError(null)
              }}
              onKeyDown={(e) => {
                // Enter añade la pestaña en vez de enviar el formulario.
                if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && url.trim()) {
                  e.preventDefault()
                  addUrl()
                }
              }}
            />
            <button type="button" className="btn" disabled={full || !url.trim()} onClick={() => addUrl()}>
              <I.Plus /> Añadir
            </button>
          </div>
          <div className="presets">
            {TAB_PRESETS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="btn sm"
                disabled={full || tabs.includes(t.url)}
                onClick={() => {
                  setTabs((list) => [...list, t.url])
                  if (error?.field === 'url') setError(null)
                }}
              >
                <I.Plus /> {t.name}
              </button>
            ))}
          </div>
          {error?.field === 'url' && (
            <p className="err" id="f-url-err">
              {error.message}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="f-notes">
            Notas <span className="opt">opcional</span>
          </label>
          <textarea
            id="f-notes"
            className="input"
            rows={2}
            maxLength={500}
            value={notes}
            placeholder="Para qué usas esta cuenta"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Dialog>
  )
}
