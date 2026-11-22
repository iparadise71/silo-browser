import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Busca actualizaciones en GitHub Releases (H8). Solo corre en la app empaquetada y
 * cuando electron-builder generó app-update.yml, es decir, cuando `publish` está configurado.
 */
export async function checkForUpdates(log: (msg: string) => void): Promise<void> {
  if (!app.isPackaged) return
  if (!existsSync(join(process.resourcesPath, 'app-update.yml'))) return
  // AppImage es el único formato de Linux que se actualiza solo.
  if (process.platform === 'linux' && !process.env.APPIMAGE) return
  // En macOS el auto-update exige firma Developer ID y un artefacto .zip: hasta entonces, descarga manual.
  if (process.platform === 'darwin') return
  try {
    // electron-updater es CommonJS: según el empaquetado, `autoUpdater` llega directo o bajo `default`.
    const mod = (await import('electron-updater')) as typeof import('electron-updater') & {
      default?: typeof import('electron-updater')
    }
    const autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater
    if (!autoUpdater) throw new Error('electron-updater no expone autoUpdater')
    autoUpdater.autoDownload = true
    autoUpdater.on('update-downloaded', (info) => {
      log(`Silo Browser ${info.version} está lista: se instala al cerrar la app.`)
    })
    autoUpdater.on('error', (err) => console.warn('[updater]', err.message))
    await autoUpdater.checkForUpdatesAndNotify()
  } catch (err) {
    console.warn('[updater]', (err as Error).message)
  }
}
