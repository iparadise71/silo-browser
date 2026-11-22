import type { Channel, Channels } from '@shared/ipc'

export const api = window.silo
export const isMac = api.platform === 'darwin'
export const modKey = isMac ? '⌘' : 'Ctrl'
export const fileManager = isMac
  ? 'Finder'
  : api.platform === 'win32'
    ? 'el Explorador'
    : 'el gestor de archivos'

export function call<C extends Channel>(
  channel: C,
  ...args: Channels[C]['args']
): Promise<Channels[C]['result']> {
  return api.invoke(channel, ...args)
}

/** Código y mensaje legible de un error que viene de main («CODE: mensaje»). */
export function errorInfo(err: unknown): { code: string; message: string } {
  const raw = err instanceof Error ? err.message : String(err)
  // Electron antepone «Error invoking remote method…» en algunos casos.
  const m = raw.match(/([A-Z_]{3,}): (.*)$/s)
  if (m) return { code: m[1]!, message: m[2]!.trim() }
  return { code: 'INTERNAL', message: raw }
}
