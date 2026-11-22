import { useState } from 'react'
import type { Profile } from '@shared/model'
import { Dialog } from './Dialog'
import { Avatar } from './ProfileCard'

interface Props {
  profile: Profile
  onClose: () => void
  onConfirm: (wipeData: boolean) => Promise<void>
}

export function DeleteDialog({ profile, onClose, onConfirm }: Props) {
  const [wipe, setWipe] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      title={`¿Eliminar ${profile.name}?`}
      role="alertdialog"
      onClose={onClose}
      as="form"
      initialFocus=".d-foot .btn"
      onSubmit={async () => {
        setBusy(true)
        await onConfirm(wipe)
        setBusy(false)
      }}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn danger" disabled={busy}>
            {wipe ? 'Eliminar y borrar datos' : 'Eliminar'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar p={profile} size="sm" />
        <p style={{ color: 'var(--muted)' }}>
          Desaparece de Silo Browser. ¿Qué hacemos con su carpeta de Chrome?
        </p>
      </div>
      <div className="choice" role="radiogroup">
        <label>
          <input type="radio" name="wipe" checked={!wipe} onChange={() => setWipe(false)} />
          <span>
            <strong>Conservar la carpeta</strong>
            <small>Cookies, sesión e historial siguen en el disco.</small>
          </span>
        </label>
        <label className="danger">
          <input type="radio" name="wipe" checked={wipe} onChange={() => setWipe(true)} />
          <span>
            <strong>Borrar la carpeta</strong>
            <small>Se borran cookies, sesión, historial y extensiones. No se puede deshacer.</small>
          </span>
        </label>
      </div>
    </Dialog>
  )
}
