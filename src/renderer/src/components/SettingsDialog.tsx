import type { AppInfo, BrowserState } from '@shared/model'
import { Dialog } from './Dialog'
import { fileManager } from '@/lib/api'

export type ThemePref = 'system' | 'dark' | 'light'

interface Props {
  browsers: BrowserState | null
  info: AppInfo | null
  theme: ThemePref
  onTheme: (t: ThemePref) => void
  onClose: () => void
  onSelect: (path: string) => void
  onPick: () => void
  onRefresh: () => void
  onRevealData: () => void
}

export function SettingsDialog({
  browsers,
  info,
  theme,
  onTheme,
  onClose,
  onSelect,
  onPick,
  onRefresh,
  onRevealData
}: Props) {
  const selected = browsers?.selected?.path
  return (
    <Dialog
      title="Ajustes"
      className="wide"
      onClose={onClose}
      footer={
        <button type="button" className="btn grad" onClick={onClose}>
          Listo
        </button>
      }
    >
      <section className="section">
        <h3>Navegador</h3>
        <p>Silo Browser abre cada perfil con este navegador. Sirve cualquiera basado en Chromium.</p>
        <div className="choice" role="radiogroup" aria-label="Navegador">
          {browsers?.candidates.map((b) => (
            <label key={b.id + b.path} className={b.found ? '' : 'off'}>
              <input
                type="radio"
                name="browser"
                disabled={!b.found}
                checked={!!b.found && b.path === selected}
                onChange={() => onSelect(b.path)}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>
                  {b.id === 'custom' ? `Personalizado · ${b.name}` : b.name}{' '}
                  {b.found ? (
                    <span className="badge">detectado{b.version ? ` · ${b.version}` : ''}</span>
                  ) : (
                    <span className="badge no">no encontrado</span>
                  )}
                </strong>
                <span className="mono selectable">{b.path}</span>
                {b.found && b.warning && <small style={{ color: 'var(--warn)' }}>{b.warning}</small>}
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn sm" onClick={onPick}>
            Elegir otro ejecutable…
          </button>
          <button type="button" className="btn sm" onClick={onRefresh}>
            Volver a detectar
          </button>
        </div>
      </section>
      <section className="section">
        <h3>Datos de los perfiles</h3>
        <p>
          Una carpeta por perfil. Al cerrar Silo Browser se cierran también los perfiles abiertos; Chrome
          guarda la sesión de cada uno.
        </p>
        <div className="pathrow">
          <span className="mono selectable" title={info?.profilesDir}>
            {info?.profilesDir}
          </span>
          <button type="button" className="btn sm" onClick={onRevealData}>
            Mostrar en {fileManager}
          </button>
        </div>
      </section>
      <section className="section">
        <h3>Apariencia</h3>
        <div className="seg" role="group" aria-label="Tema" style={{ alignSelf: 'flex-start' }}>
          {(
            [
              ['system', 'Sistema'],
              ['dark', 'Oscuro'],
              ['light', 'Claro']
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={theme === v} onClick={() => onTheme(v)}>
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="section">
        <h3>Acerca de</h3>
        <div className="pathrow">
          <span className="mono">
            Silo Browser {info?.version} · {info?.platform}
          </span>
        </div>
      </section>
    </Dialog>
  )
}
