import { execFile } from 'node:child_process'
import { accessSync, constants, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { BrowserCandidate } from '@shared/model'

interface KnownBrowser {
  id: string
  name: string
  paths: string[]
}

/** Rutas conocidas por plataforma, en orden de preferencia. */
export function knownBrowsers(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): KnownBrowser[] {
  if (platform === 'darwin') {
    const app = (bundle: string, bin: string) => [
      `/Applications/${bundle}.app/Contents/MacOS/${bin}`,
      ...(env.HOME ? [join(env.HOME, 'Applications', `${bundle}.app`, 'Contents', 'MacOS', bin)] : [])
    ]
    return [
      { id: 'chrome', name: 'Google Chrome', paths: app('Google Chrome', 'Google Chrome') },
      { id: 'brave', name: 'Brave', paths: app('Brave Browser', 'Brave Browser') },
      { id: 'edge', name: 'Microsoft Edge', paths: app('Microsoft Edge', 'Microsoft Edge') },
      { id: 'chromium', name: 'Chromium', paths: app('Chromium', 'Chromium') }
    ]
  }
  if (platform === 'linux') {
    return [
      {
        id: 'chrome',
        name: 'Google Chrome',
        paths: ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/opt/google/chrome/chrome']
      },
      {
        id: 'brave',
        name: 'Brave',
        paths: ['/usr/bin/brave-browser', '/usr/bin/brave-browser-stable', '/opt/brave.com/brave/brave']
      },
      {
        id: 'edge',
        name: 'Microsoft Edge',
        paths: ['/usr/bin/microsoft-edge-stable', '/usr/bin/microsoft-edge', '/opt/microsoft/msedge/msedge']
      },
      {
        id: 'chromium',
        name: 'Chromium',
        paths: ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']
      }
    ]
  }
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean) as string[]
    const under = (...rel: string[]) => roots.map((r) => join(r, ...rel))
    return [
      { id: 'chrome', name: 'Google Chrome', paths: under('Google', 'Chrome', 'Application', 'chrome.exe') },
      {
        id: 'brave',
        name: 'Brave',
        paths: under('BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
      },
      { id: 'edge', name: 'Microsoft Edge', paths: under('Microsoft', 'Edge', 'Application', 'msedge.exe') },
      { id: 'chromium', name: 'Chromium', paths: under('Chromium', 'Application', 'chrome.exe') }
    ]
  }
  return []
}

/** Aviso para navegadores que no pueden usar la carpeta de datos de Silo. */
export function warningFor(path: string): string | undefined {
  if (path.startsWith('/snap/')) {
    return 'Instalado como snap: el confinamiento puede impedir usar la carpeta de Silo Browser. Prefiere el paquete .deb.'
  }
  return undefined
}

export interface DetectDeps {
  isExecutable: (path: string) => boolean
  version: (path: string) => Promise<string | null>
}

export async function detectBrowsers(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  deps: DetectDeps
): Promise<BrowserCandidate[]> {
  return Promise.all(
    knownBrowsers(platform, env).map(async (b) => {
      const path = b.paths.find((p) => deps.isExecutable(p))
      if (!path) return { id: b.id, name: b.name, path: b.paths[0] ?? '', version: null, found: false }
      return {
        id: b.id,
        name: b.name,
        path,
        version: await deps.version(path),
        found: true,
        warning: warningFor(path)
      }
    })
  )
}

/** Un nombre de ejecutable que parece Chromium. Evita que se elija cualquier binario. */
export function looksLikeChromium(path: string): boolean {
  const name = basename(path)
    .toLowerCase()
    .replace(/\.exe$/, '')
  return /chrome|chromium|brave|msedge|edge|vivaldi|opera|thorium|helium/.test(name)
}

/* ---------- Implementaciones reales ---------- */

export function isExecutable(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false
    if (process.platform !== 'win32') accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Versión desde Info.plist en macOS (rápido) o con `--version` en el resto. */
export function readVersion(path: string): Promise<string | null> {
  if (process.platform === 'darwin') {
    const m = path.match(/^(.*\.app)\/Contents\/MacOS\//)
    if (m) {
      try {
        const plist = readFileSync(join(m[1]!, 'Contents', 'Info.plist'), 'utf8')
        const v = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)
        if (v) return Promise.resolve(v[1]!)
      } catch {
        /* sigue con --version */
      }
    }
  }
  if (process.platform === 'win32') return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile(path, ['--version'], { timeout: 4000 }, (err, stdout) => {
      if (err) return resolve(null)
      const v = stdout.match(/(\d+\.\d+(?:\.\d+)*(?:\.\d+)?)/)
      resolve(v ? v[1]! : null)
    })
  })
}

export const realDetectDeps: DetectDeps = { isExecutable, version: readVersion }
