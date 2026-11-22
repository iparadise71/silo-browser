import { access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { SiloService } from '../src/main/service'
import type { RunningDeps } from '../src/main/browser/launcher'
import { makeRepo } from './helpers'

async function setup(opts: { browsers?: string[]; running?: Set<string> } = {}) {
  const { repo, dir } = await makeRepo()
  const profilesDir = join(dir, 'profiles')
  const runningDirs = opts.running ?? new Set<string>()
  const present = new Set(opts.browsers ?? ['/usr/bin/google-chrome-stable'])
  const launched: { bin: string; args: string[] }[] = []
  // Chrome falso: cada carpeta abierta tiene un PID; SIGTERM la cierra salvo que sea «terca».
  const pids = new Map<string, number>()
  const pidOf = (d: string) => pids.get(d) ?? (pids.set(d, 1000 + pids.size), pids.get(d)!)
  const stubborn = new Set<string>()
  const signals: { pid: number; sig: string }[] = []
  const running: RunningDeps = {
    platform: 'linux',
    hostname: () => 'h',
    readlink: async (p) => {
      const d = p.replace(/\/SingletonLock$/, '')
      if (runningDirs.has(d)) return `h-${pidOf(d)}`
      throw new Error('ENOENT')
    },
    exists: async () => false,
    isAlive: () => true,
    signal: (pid, sig) => {
      signals.push({ pid, sig })
      const d = [...pids].find(([, v]) => v === pid)?.[0]
      if (d && (sig === 'SIGKILL' || !stubborn.has(d))) runningDirs.delete(d)
    }
  }
  const service = new SiloService({
    repo,
    profilesDir,
    platform: 'linux',
    env: {},
    detect: { isExecutable: (p) => present.has(p), version: async () => '131.0' },
    running,
    launch: vi.fn(async (bin: string, args: string[]) => {
      launched.push({ bin, args })
      return 1
    })
  })
  return { service, repo, profilesDir, launched, runningDirs, present, signals, stubborn, pidOf }
}

const input = { name: 'Trabajo', color: 'azul' as const, emoji: '💼', tabs: ['https://mail.google.com'] }

describe('SiloService', () => {
  it('crear crea la carpeta del perfil y registra actividad', async () => {
    const { service, profilesDir } = await setup()
    const events: string[] = []
    service.on('activity', (a) => events.push(a.kind))
    const p = await service.create(input)
    await access(join(profilesDir, p.id))
    expect(events).toEqual(['created'])
  })

  it('abrir lanza Chrome con su carpeta y la página de inicio', async () => {
    const { service, launched, profilesDir, repo } = await setup()
    const p = await service.create(input)
    expect(await service.open(p.id)).toEqual({ mode: 'launched' })
    expect(launched[0]!.bin).toBe('/usr/bin/google-chrome-stable')
    expect(launched[0]!.args).toEqual([
      `--user-data-dir=${join(profilesDir, p.id)}`,
      '--no-first-run',
      '--no-default-browser-check',
      'https://mail.google.com'
    ])
    expect(repo.get(p.id).lastOpenedAt).not.toBeNull()
    expect(service.snapshot().running).toEqual([p.id])
  })

  it('abrir pasa todas las pestañas de inicio en orden', async () => {
    const { service, launched } = await setup()
    const tabs = ['https://ads.google.com', 'https://analytics.google.com', 'https://mail.google.com']
    const details: string[] = []
    service.on('activity', (a) => details.push(a.detail))
    const p = await service.create({ ...input, tabs })
    await service.open(p.id)
    expect(launched[0]!.args.slice(3)).toEqual(tabs)
    expect(details.at(-1)).toBe('abierto con 3 pestañas')
  })

  it('sin pestañas de inicio abre Chrome sin URL', async () => {
    const { service, launched } = await setup()
    const p = await service.create({ ...input, tabs: [] })
    await service.open(p.id)
    expect(launched[0]!.args).toHaveLength(3)
  })

  it('si ya está abierto pide otra ventana en vez de otra instancia', async () => {
    const { service, launched, profilesDir, runningDirs } = await setup()
    const p = await service.create(input)
    runningDirs.add(join(profilesDir, p.id))
    expect(await service.open(p.id)).toEqual({ mode: 'window' })
    expect(launched[0]!.args).toContain('--new-window')
    expect(launched[0]!.args).not.toContain('https://mail.google.com')
  })

  it('sin navegador devuelve NO_BROWSER', async () => {
    const { service } = await setup({ browsers: [] })
    const p = await service.create(input)
    await expect(service.open(p.id)).rejects.toMatchObject({ code: 'NO_BROWSER' })
  })

  it('no elimina un perfil abierto; con wipe borra la carpeta', async () => {
    const { service, profilesDir, runningDirs } = await setup()
    const p = await service.create(input)
    const dir = join(profilesDir, p.id)
    await writeFile(join(dir, 'Cookies'), 'x')
    runningDirs.add(dir)
    await expect(service.remove(p.id, true)).rejects.toMatchObject({ code: 'PROFILE_RUNNING' })
    runningDirs.delete(dir)
    await service.remove(p.id, true)
    await expect(access(dir)).rejects.toThrow()
  })

  it('eliminar sin wipe conserva la carpeta', async () => {
    const { service, profilesDir } = await setup()
    const p = await service.create(input)
    await service.remove(p.id, false)
    await access(join(profilesDir, p.id))
    expect(service.snapshot().profiles).toEqual([])
  })

  it('el sondeo detecta cuando Chrome se cierra', async () => {
    const { service, profilesDir, runningDirs } = await setup()
    const p = await service.create(input)
    runningDirs.add(join(profilesDir, p.id))
    await service.poll()
    expect(service.snapshot().running).toEqual([p.id])
    const kinds: string[] = []
    service.on('activity', (a) => kinds.push(a.kind))
    runningDirs.clear()
    await service.poll()
    expect(service.snapshot().running).toEqual([])
    expect(kinds).toEqual(['closed'])
  })

  it('elegir navegador: acepta Chromium personalizado y rechaza otros binarios', async () => {
    const { service, present } = await setup({ browsers: [] })
    present.add('/opt/thorium/thorium-browser')
    present.add('/bin/ls')
    const st = await service.selectBrowser('/opt/thorium/thorium-browser')
    expect(st.selected).toMatchObject({ id: 'custom', path: '/opt/thorium/thorium-browser' })
    await expect(service.selectBrowser('/bin/ls')).rejects.toMatchObject({ code: 'INVALID_BROWSER' })
    await expect(service.selectBrowser('/no/existe')).rejects.toMatchObject({ code: 'INVALID_BROWSER' })
  })

  it('rechaza ids que intentan salir de la carpeta de perfiles', async () => {
    const { service } = await setup()
    expect(() => service.profileDir('../../etc')).toThrow(/no válido/)
  })

  it('cerrar todo envía SIGTERM a cada perfil abierto y los deja cerrados', async () => {
    const { service, profilesDir, runningDirs, signals, pidOf } = await setup()
    const a = await service.create(input)
    const b = await service.create({ ...input, name: 'Personal' })
    const c = await service.create({ ...input, name: 'Cerrado' })
    for (const p of [a, b]) runningDirs.add(join(profilesDir, p.id))
    const r = await service.closeAll({ graceMs: 400, stepMs: 20 })
    expect(r).toEqual({ closed: 2, forced: 0, failed: [] })
    expect(signals).toEqual([
      { pid: pidOf(join(profilesDir, a.id)), sig: 'SIGTERM' },
      { pid: pidOf(join(profilesDir, b.id)), sig: 'SIGTERM' }
    ])
    expect(service.snapshot().running).toEqual([])
    expect(signals.some((s) => s.pid === pids(c.id))).toBe(false)
    function pids(id: string) {
      return pidOf(join(profilesDir, id))
    }
  })

  it('si un Chrome no responde a SIGTERM, lo fuerza con SIGKILL', async () => {
    const { service, profilesDir, runningDirs, signals, stubborn } = await setup()
    const a = await service.create(input)
    const dir = join(profilesDir, a.id)
    runningDirs.add(dir)
    stubborn.add(dir)
    const r = await service.closeAll({ graceMs: 100, stepMs: 20 })
    expect(r).toEqual({ closed: 1, forced: 1, failed: [] })
    expect(signals.map((s) => s.sig)).toEqual(['SIGTERM', 'SIGKILL'])
  })

  it('sin perfiles abiertos no envía señales', async () => {
    const { service, signals } = await setup()
    await service.create(input)
    expect(await service.closeAll()).toEqual({ closed: 0, forced: 0, failed: [] })
    expect(signals).toEqual([])
  })

  it('detener un perfil cierra solo ese y lo registra una vez en la actividad', async () => {
    const { service, profilesDir, runningDirs, signals, pidOf } = await setup()
    const a = await service.create(input)
    const b = await service.create({ ...input, name: 'Personal' })
    runningDirs.add(join(profilesDir, a.id))
    runningDirs.add(join(profilesDir, b.id))
    await service.poll()
    const log: string[] = []
    service.on('activity', (e) => log.push(`${e.kind}:${e.profileName}:${e.detail}`))
    expect(await service.stopProfiles([a.id], { graceMs: 200, stepMs: 20 })).toEqual({
      closed: 1,
      forced: 0,
      failed: []
    })
    expect(signals).toEqual([{ pid: pidOf(join(profilesDir, a.id)), sig: 'SIGTERM' }])
    expect(service.snapshot().running).toEqual([b.id])
    await service.poll()
    expect(log).toEqual(['closed:Trabajo:detenido'])
  })

  it('detener un perfil cerrado no hace nada', async () => {
    const { service, signals } = await setup()
    const a = await service.create(input)
    expect(await service.stopProfiles([a.id])).toEqual({ closed: 0, forced: 0, failed: [] })
    expect(signals).toEqual([])
  })
})
