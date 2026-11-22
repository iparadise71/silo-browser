import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { hostname as osHostname } from 'node:os'
import { join } from 'node:path'

/** Argumentos de Chrome. Sin remote debugging ni --enable-automation: el login de Google es manual. */
export function buildArgs(opts: { userDataDir: string; urls?: string[]; newWindow?: boolean }): string[] {
  const args = [`--user-data-dir=${opts.userDataDir}`, '--no-first-run', '--no-default-browser-check']
  if (opts.newWindow) args.push('--new-window')
  // Chrome abre una pestaña por cada URL, en este orden.
  if (opts.urls) args.push(...opts.urls)
  return args
}

type SpawnFn = (cmd: string, args: string[], opts: SpawnOptions) => ReturnType<typeof nodeSpawn>

/**
 * Lanza el navegador desacoplado de Silo: cerrar Silo no cierra Chrome.
 * Resuelve cuando el proceso arrancó; rechaza si el ejecutable no se pudo lanzar.
 */
export function launch(bin: string, args: string[], spawn: SpawnFn = nodeSpawn): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof nodeSpawn>
    try {
      child = spawn(bin, args, { detached: true, stdio: 'ignore', shell: false })
    } catch (err) {
      reject(err)
      return
    }
    child.once('error', reject)
    child.once('spawn', () => {
      child.removeListener('error', reject)
      child.on('error', () => undefined)
      child.unref()
      resolve(child.pid)
    })
  })
}

/**
 * Siembra el nombre del perfil en Preferences antes del primer arranque,
 * para que Chrome lo muestre en la ventana. No toca un perfil ya creado.
 */
export async function seedPreferences(userDataDir: string, profileName: string): Promise<void> {
  const dir = join(userDataDir, 'Default')
  const file = join(dir, 'Preferences')
  try {
    await fs.access(file)
    return
  } catch {
    /* no existe: se crea */
  }
  await fs.mkdir(dir, { recursive: true })
  const prefs = { profile: { name: profileName }, browser: { has_seen_welcome_page: true } }
  await fs.writeFile(file, JSON.stringify(prefs), 'utf8')
}

/* ---------- ¿Está abierto? ---------- */

/** El SingletonLock de Chrome en macOS y Linux es un symlink a `<hostname>-<pid>`. */
export function parseSingletonTarget(target: string): { host: string; pid: number } | null {
  const m = target.match(/^(.*)-(\d+)$/)
  if (!m) return null
  return { host: m[1]!, pid: Number(m[2]) }
}

export interface RunningDeps {
  platform: NodeJS.Platform
  hostname: () => string
  readlink: (path: string) => Promise<string>
  exists: (path: string) => Promise<boolean>
  isAlive: (pid: number) => boolean
  /** Envía una señal a un proceso (process.kill). */
  signal: (pid: number, sig: NodeJS.Signals) => void
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export const realRunningDeps: RunningDeps = {
  platform: process.platform,
  hostname: osHostname,
  readlink: (p) => fs.readlink(p),
  exists: (p) =>
    fs.lstat(p).then(
      () => true,
      () => false
    ),
  isAlive: isPidAlive,
  signal: (pid, sig) => {
    process.kill(pid, sig)
  }
}

/**
 * Decide si hay un Chrome vivo usando esta carpeta. No depende del PID que lanzó Silo:
 * ese proceso termina enseguida si Chrome ya estaba abierto, y se pierde al reiniciar Silo.
 */
export async function isProfileRunning(
  userDataDir: string,
  deps: RunningDeps = realRunningDeps
): Promise<boolean> {
  if (deps.platform === 'win32') {
    // En Windows Chrome mantiene `lockfile` abierto mientras corre.
    return deps.exists(join(userDataDir, 'lockfile'))
  }
  let target: string
  try {
    target = await deps.readlink(join(userDataDir, 'SingletonLock'))
  } catch {
    return false
  }
  const lock = parseSingletonTarget(target)
  if (!lock) return false
  // Un lock de otra máquina (carpeta compartida) no se puede verificar: se considera abierto.
  if (lock.host !== deps.hostname()) return true
  return deps.isAlive(lock.pid)
}

/**
 * PID del proceso principal de Chrome que tiene tomada la carpeta, leído del SingletonLock
 * (macOS y Linux). null si no hay lock, es de otra máquina o el proceso ya no existe.
 */
export async function lockPid(
  userDataDir: string,
  deps: RunningDeps = realRunningDeps
): Promise<number | null> {
  if (deps.platform === 'win32') return null
  let target: string
  try {
    target = await deps.readlink(join(userDataDir, 'SingletonLock'))
  } catch {
    return null
  }
  const lock = parseSingletonTarget(target)
  if (!lock || lock.host !== deps.hostname() || !deps.isAlive(lock.pid)) return null
  return lock.pid
}
