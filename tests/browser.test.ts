import { chmod, readFile, writeFile, readlink, symlink } from 'node:fs/promises'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectBrowsers, knownBrowsers, looksLikeChromium, warningFor } from '../src/main/browser/detect'
import {
  buildArgs,
  isProfileRunning,
  launch,
  parseSingletonTarget,
  seedPreferences,
  type RunningDeps
} from '../src/main/browser/launcher'
import { tempDir } from './helpers'

describe('detección de navegadores', () => {
  it('conoce rutas de Chrome en macOS, Ubuntu y Windows', () => {
    expect(knownBrowsers('darwin', { HOME: '/Users/a' })[0]!.paths[0]).toBe(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    )
    expect(knownBrowsers('linux', {})[0]!.paths).toContain('/usr/bin/google-chrome-stable')
    expect(knownBrowsers('win32', { PROGRAMFILES: 'C:\\PF' })[0]!.paths[0]).toMatch(/chrome\.exe$/)
  })

  it('marca encontrados, versión y aviso de snap', async () => {
    const present = new Set(['/usr/bin/google-chrome-stable', '/snap/bin/chromium'])
    const list = await detectBrowsers(
      'linux',
      {},
      { isExecutable: (p) => present.has(p), version: async (p) => (p.includes('chrome') ? '131.0.1' : null) }
    )
    const byId = Object.fromEntries(list.map((b) => [b.id, b]))
    expect(byId.chrome).toMatchObject({
      found: true,
      version: '131.0.1',
      path: '/usr/bin/google-chrome-stable'
    })
    expect(byId.brave).toMatchObject({ found: false })
    expect(byId.chromium!.warning).toMatch(/snap/)
    expect(warningFor('/usr/bin/chromium')).toBeUndefined()
  })

  it('reconoce ejecutables tipo Chromium', () => {
    expect(looksLikeChromium('/opt/google/chrome/chrome')).toBe(true)
    expect(looksLikeChromium('C:\\x\\msedge.exe')).toBe(true)
    expect(looksLikeChromium('/bin/rm')).toBe(false)
  })
})

describe('lanzador', () => {
  it('arma argumentos sin flags de automatización', () => {
    expect(buildArgs({ userDataDir: '/d', urls: ['https://mail.google.com'] })).toEqual([
      '--user-data-dir=/d',
      '--no-first-run',
      '--no-default-browser-check',
      'https://mail.google.com'
    ])
    // Varias pestañas: una URL por argumento, en el orden guardado.
    expect(buildArgs({ userDataDir: '/d', urls: ['https://b.test', 'https://a.test'] }).slice(3)).toEqual([
      'https://b.test',
      'https://a.test'
    ])
    expect(buildArgs({ userDataDir: '/d', urls: [] })).toHaveLength(3)
    const args = buildArgs({ userDataDir: '/d', newWindow: true })
    expect(args).toContain('--new-window')
    expect(args.join(' ')).not.toMatch(/remote-debugging|enable-automation/)
  })

  it('lanza un ejecutable real y le pasa los argumentos', async () => {
    if (process.platform === 'win32') return
    const dir = await tempDir()
    const out = join(dir, 'args.txt')
    const bin = join(dir, 'fake-chrome')
    // Escribe a un temporal y renombra: el test nunca lee un archivo a medio escribir.
    await writeFile(bin, `#!/bin/sh\nprintf '%s\\n' "$@" > "${out}.tmp" && mv "${out}.tmp" "${out}"\n`)
    await chmod(bin, 0o755)
    const pid = await launch(bin, buildArgs({ userDataDir: '/tmp/p 1', urls: ['https://x.test'] }))
    expect(pid).toBeGreaterThan(0)
    let text = ''
    for (let i = 0; i < 50 && !text; i++) {
      await new Promise((r) => setTimeout(r, 100))
      text = await readFile(out, 'utf8').catch(() => '')
    }
    expect(text.trim().split('\n')).toEqual([
      '--user-data-dir=/tmp/p 1',
      '--no-first-run',
      '--no-default-browser-check',
      'https://x.test'
    ])
  })

  it('rechaza si el ejecutable no existe', async () => {
    await expect(launch('/no/existe/chrome', [])).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('siembra Preferences una sola vez', async () => {
    const dir = await tempDir()
    await seedPreferences(dir, 'Trabajo')
    const file = join(dir, 'Default', 'Preferences')
    expect(JSON.parse(await readFile(file, 'utf8')).profile.name).toBe('Trabajo')
    await writeFile(file, '{"profile":{"name":"Chrome lo cambió"}}')
    await seedPreferences(dir, 'Otro')
    expect(JSON.parse(await readFile(file, 'utf8')).profile.name).toBe('Chrome lo cambió')
  })
})

describe('perfil abierto (SingletonLock)', () => {
  const deps = (over: Partial<RunningDeps>): RunningDeps => ({
    platform: 'linux',
    hostname: () => 'mi-mac',
    readlink: async () => 'mi-mac-4242',
    exists: async () => false,
    isAlive: () => true,
    signal: () => undefined,
    ...over
  })

  it('parsea host y pid aunque el host tenga guiones', () => {
    expect(parseSingletonTarget('mi-mac.local-123')).toEqual({ host: 'mi-mac.local', pid: 123 })
    expect(parseSingletonTarget('basura')).toBeNull()
  })

  it('abierto si el pid vive en esta máquina', async () => {
    expect(await isProfileRunning('/p', deps({}))).toBe(true)
    expect(await isProfileRunning('/p', deps({ isAlive: () => false }))).toBe(false)
  })

  it('cerrado si no hay lock; abierto si el lock es de otra máquina', async () => {
    expect(
      await isProfileRunning('/p', deps({ readlink: async () => Promise.reject(new Error('ENOENT')) }))
    ).toBe(false)
    expect(await isProfileRunning('/p', deps({ readlink: async () => 'otra-1', isAlive: () => false }))).toBe(
      true
    )
  })

  it('Windows usa lockfile', async () => {
    expect(await isProfileRunning('C:\\p', deps({ platform: 'win32', exists: async () => true }))).toBe(true)
  })

  it('lee un symlink real con el pid del proceso actual', async () => {
    if (process.platform === 'win32') return
    const dir = await tempDir()
    await symlink(`${hostname()}-${process.pid}`, join(dir, 'SingletonLock'))
    expect(await readlink(join(dir, 'SingletonLock'))).toBe(`${hostname()}-${process.pid}`)
    expect(await isProfileRunning(dir)).toBe(true)
  })
})
