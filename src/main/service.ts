import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { basename, join, relative, isAbsolute } from 'node:path'
import {
  type ActivityEntry,
  type ActivityKind,
  type BrowserCandidate,
  type BrowserState,
  type Group,
  type Profile,
  type ProfileInput,
  type ProfilePatch,
  type Snapshot
} from '@shared/model'
import { hostOf } from '@shared/filter'
import { SiloError } from '@shared/ipc'
import type { ProfileRepository } from './store/repository'
import { detectBrowsers, looksLikeChromium, type DetectDeps } from './browser/detect'
import {
  buildArgs,
  isProfileRunning,
  launch,
  lockPid,
  realRunningDeps,
  seedPreferences,
  type RunningDeps
} from './browser/launcher'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ServiceDeps {
  repo: ProfileRepository
  profilesDir: string
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  detect: DetectDeps
  running?: RunningDeps
  launch?: typeof launch
  now?: () => Date
  pollMs?: number
}

export interface StopOptions {
  graceMs?: number
  stepMs?: number
}

export interface StopResult {
  closed: number
  forced: number
  failed: string[]
}

export interface ServiceEvents {
  state: [Snapshot]
  activity: [ActivityEntry]
}

export class SiloService extends EventEmitter<ServiceEvents> {
  private runningIds = new Set<string>()
  private activityLog: ActivityEntry[] = []
  private activitySeq = 0
  private candidates: BrowserCandidate[] | null = null
  private timer: NodeJS.Timeout | null = null
  private polling = false
  /** PID que devolvió el lanzamiento; respaldo cuando el lock no trae PID (Windows). */
  private launchedPids = new Map<string, number>()

  constructor(private readonly d: ServiceDeps) {
    super()
  }

  /* ---------- Lectura ---------- */

  snapshot(): Snapshot {
    return { profiles: this.d.repo.list(), groups: this.d.repo.groups(), running: [...this.runningIds] }
  }

  activity(): ActivityEntry[] {
    return [...this.activityLog]
  }

  /** Carpeta de datos del perfil. Rechaza ids que no sean UUID para no salir de profilesDir. */
  profileDir(id: string): string {
    if (!UUID.test(id)) throw new SiloError('VALIDATION', 'Id de perfil no válido.')
    return join(this.d.profilesDir, id)
  }

  /* ---------- Perfiles ---------- */

  async create(input: ProfileInput): Promise<Profile> {
    const p = await this.d.repo.create(input)
    await fs.mkdir(this.profileDir(p.id), { recursive: true })
    this.log('created', p, 'creado')
    this.changed()
    return p
  }

  async update(id: string, patch: ProfilePatch): Promise<Profile> {
    const p = await this.d.repo.update(id, patch)
    this.changed()
    return p
  }

  async duplicate(id: string): Promise<Profile> {
    const p = await this.d.repo.duplicate(id)
    await fs.mkdir(this.profileDir(p.id), { recursive: true })
    this.log('created', p, 'creado como copia, sin sesión')
    this.changed()
    return p
  }

  async move(ids: string[], groupId: string | null): Promise<void> {
    await this.d.repo.moveToGroup(ids, groupId)
    this.changed()
  }

  async remove(id: string, wipeData: boolean): Promise<void> {
    const p = this.d.repo.get(id)
    const dir = this.profileDir(id)
    if (await isProfileRunning(dir, this.d.running)) {
      throw new SiloError('PROFILE_RUNNING', `Cierra Chrome de «${p.name}» para eliminarlo.`)
    }
    await this.d.repo.remove(id)
    this.runningIds.delete(id)
    if (wipeData) {
      const rel = relative(this.d.profilesDir, dir)
      if (!rel || rel.startsWith('..') || isAbsolute(rel))
        throw new SiloError('INTERNAL', 'Ruta fuera de la carpeta de perfiles.')
      await fs.rm(dir, { recursive: true, force: true })
    }
    this.log('deleted', p, wipeData ? 'eliminado y su carpeta borrada' : 'eliminado; la carpeta se conservó')
    this.changed()
  }

  async createGroup(name: string): Promise<Group> {
    const g = await this.d.repo.createGroup(name)
    this.changed()
    return g
  }

  async removeGroup(id: string): Promise<void> {
    await this.d.repo.removeGroup(id)
    this.changed()
  }

  /* ---------- Abrir ---------- */

  async open(id: string): Promise<{ mode: 'launched' | 'window' }> {
    const p = this.d.repo.get(id)
    const browser = (await this.browserState()).selected
    if (!browser) throw new SiloError('NO_BROWSER', 'No hay un navegador configurado. Elige uno en Ajustes.')
    const dir = this.profileDir(id)
    const alreadyRunning = await isProfileRunning(dir, this.d.running)
    await fs.mkdir(dir, { recursive: true })
    if (!alreadyRunning) await seedPreferences(dir, p.name)
    // Con el perfil abierto, el Chrome existente recibe el lanzamiento y abre otra ventana.
    const args = buildArgs({
      userDataDir: dir,
      urls: alreadyRunning ? undefined : p.tabs,
      newWindow: alreadyRunning
    })
    try {
      const pid = await (this.d.launch ?? launch)(browser.path, args)
      if (!alreadyRunning && pid) this.launchedPids.set(id, pid)
    } catch (err) {
      const msg = `No se pudo abrir ${browser.name}: ${(err as Error).message}`
      this.log('error', p, msg)
      throw new SiloError('LAUNCH_FAILED', msg)
    }
    await this.d.repo.markOpened(id)
    this.runningIds.add(id)
    if (alreadyRunning) this.log('window', p, 'nueva ventana')
    else if (p.tabs.length > 1) this.log('opened', p, `abierto con ${p.tabs.length} pestañas`)
    else this.log('opened', p, p.tabs[0] ? `abierto en ${hostOf(p.tabs[0])}` : 'abierto')
    this.changed()
    // Si Chrome no llegó a arrancar, el sondeo lo corrige.
    setTimeout(() => void this.poll(), 2500).unref?.()
    return { mode: alreadyRunning ? 'window' : 'launched' }
  }

  /* ---------- Navegador ---------- */

  async browserState(refresh = false): Promise<BrowserState> {
    if (!this.candidates || refresh) {
      this.candidates = await detectBrowsers(this.d.platform, this.d.env, this.d.detect)
    }
    const candidates = this.candidates
    const chosen = this.d.repo.settings().browserPath
    let selected: BrowserCandidate | null = null
    if (chosen) {
      selected = candidates.find((c) => c.found && c.path === chosen) ?? null
      if (!selected && this.d.detect.isExecutable(chosen)) {
        selected = {
          id: 'custom',
          name: basename(chosen).replace(/\.exe$/i, ''),
          path: chosen,
          version: await this.d.detect.version(chosen),
          found: true
        }
      }
    }
    selected ??= candidates.find((c) => c.found) ?? null
    const list = selected && selected.id === 'custom' ? [...candidates, selected] : candidates
    return { candidates: list, selected }
  }

  async selectBrowser(path: string): Promise<BrowserState> {
    if (!this.d.detect.isExecutable(path))
      throw new SiloError('INVALID_BROWSER', 'El archivo no existe o no es ejecutable.')
    const known = (this.candidates ?? []).some((c) => c.path === path)
    if (!known && !looksLikeChromium(path)) {
      throw new SiloError('INVALID_BROWSER', 'Elige el ejecutable de Chrome, Chromium, Brave o Edge.')
    }
    await this.d.repo.updateSettings({ browserPath: path })
    return this.browserState()
  }

  /* ---------- Cerrar ---------- */

  /** Detiene el navegador de todos los perfiles abiertos (al salir de la app). */
  async closeAll(opts: StopOptions = {}): Promise<StopResult> {
    await this.poll()
    return this.stopProfiles([...this.runningIds], opts)
  }

  /**
   * Detiene por completo el Chrome de los perfiles indicados. Primero SIGTERM (Chrome guarda
   * la sesión y cierra solo); los que sigan vivos tras `graceMs` se fuerzan con SIGKILL.
   */
  async stopProfiles(ids: string[], opts: StopOptions = {}): Promise<StopResult> {
    const graceMs = opts.graceMs ?? 6000
    const stepMs = opts.stepMs ?? 200
    const deps = this.d.running ?? realRunningDeps
    await this.poll()
    const targets: { p: Profile; dir: string; pid: number | null }[] = []
    for (const id of new Set(ids)) {
      if (!this.runningIds.has(id)) continue
      const p = this.d.repo.get(id)
      const dir = this.profileDir(id)
      targets.push({ p, dir, pid: (await lockPid(dir, deps)) ?? this.launchedPids.get(id) ?? null })
    }
    if (!targets.length) return { closed: 0, forced: 0, failed: [] }

    const send = (pid: number, sig: NodeJS.Signals) => {
      try {
        deps.signal(pid, sig)
      } catch {
        /* ya terminó */
      }
    }
    for (const t of targets) if (t.pid) send(t.pid, 'SIGTERM')

    const stillOpen = async () => {
      const states = await Promise.all(targets.map((t) => isProfileRunning(t.dir, deps)))
      return targets.filter((_, i) => states[i])
    }
    let open = await stillOpen()
    for (let waited = 0; open.length && waited < graceMs; waited += stepMs) {
      await new Promise((r) => setTimeout(r, stepMs))
      open = await stillOpen()
    }
    const forcedIds = new Set<string>()
    if (open.length) {
      for (const t of open) {
        if (t.pid) {
          send(t.pid, 'SIGKILL')
          forcedIds.add(t.p.id)
        }
      }
      await new Promise((r) => setTimeout(r, Math.min(1000, graceMs)))
      open = await stillOpen()
    }
    const failed = new Set(open.map((t) => t.p.id))
    for (const t of targets) {
      this.launchedPids.delete(t.p.id)
      if (failed.has(t.p.id)) {
        this.log('error', t.p, 'no se pudo detener Chrome')
        continue
      }
      // Se registra aquí (y se saca de runningIds) para que el sondeo no lo anote otra vez.
      this.runningIds.delete(t.p.id)
      this.log('closed', t.p, forcedIds.has(t.p.id) ? 'detenido (cierre forzado)' : 'detenido')
    }
    this.changed()
    return {
      closed: targets.length - failed.size,
      forced: [...forcedIds].filter((id) => !failed.has(id)).length,
      failed: open.map((t) => t.p.name)
    }
  }

  /* ---------- Estado abierto/cerrado ---------- */

  start(): void {
    void this.poll()
    this.timer = setInterval(() => void this.poll(), this.d.pollMs ?? 2000)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      const profiles = this.d.repo.list()
      const states = await Promise.all(
        profiles.map((p) => isProfileRunning(this.profileDir(p.id), this.d.running))
      )
      const next = new Set(profiles.filter((_, i) => states[i]).map((p) => p.id))
      let diff = next.size !== this.runningIds.size
      for (const p of profiles) {
        const was = this.runningIds.has(p.id)
        const is = next.has(p.id)
        if (was !== is) diff = true
        if (was && !is) this.log('closed', p, 'Chrome cerrado')
      }
      this.runningIds = next
      if (diff) this.changed()
    } finally {
      this.polling = false
    }
  }

  /* ---------- Interno ---------- */

  logSystem(kind: ActivityKind, detail: string): void {
    this.push({ kind, profileId: null, profileName: '', detail })
  }

  private log(kind: ActivityKind, p: Profile, detail: string) {
    this.push({ kind, profileId: p.id, profileName: p.name, detail })
  }

  private push(e: Omit<ActivityEntry, 'id' | 'at'>) {
    const entry: ActivityEntry = {
      id: ++this.activitySeq,
      at: (this.d.now ?? (() => new Date()))().toISOString(),
      ...e
    }
    this.activityLog = [entry, ...this.activityLog].slice(0, 200)
    this.emit('activity', entry)
  }

  private changed() {
    this.emit('state', this.snapshot())
  }
}
