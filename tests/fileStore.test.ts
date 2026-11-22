import { readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileStore, migrate } from '../src/main/store/fileStore'
import { emptyStore, SCHEMA_VERSION } from '@shared/model'
import { tempDir } from './helpers'

describe('FileStore', () => {
  it('arranca vacío si el archivo no existe', async () => {
    const store = new FileStore(join(await tempDir(), 'silo.json'))
    const r = await store.load()
    expect(r.data).toEqual(emptyStore())
    expect(r.recoveredFrom).toBeNull()
  })

  it('guarda y vuelve a leer', async () => {
    const path = join(await tempDir(), 'sub', 'silo.json')
    const store = new FileStore(path)
    const data = { ...emptyStore(), settings: { browserPath: '/usr/bin/chromium' } }
    await store.save(data)
    expect((await new FileStore(path).load()).data).toEqual(data)
  })

  it('respalda un JSON roto en .bak y arranca vacío', async () => {
    const dir = await tempDir()
    const path = join(dir, 'silo.json')
    await writeFile(path, '{ esto no es json', 'utf8')
    const r = await new FileStore(path).load()
    expect(r.data).toEqual(emptyStore())
    expect(r.recoveredFrom).toBe(`${path}.bak`)
    expect(await readFile(`${path}.bak`, 'utf8')).toBe('{ esto no es json')
    await expect(access(path)).rejects.toThrow()
  })

  it('respalda un JSON que no cumple el schema', async () => {
    const path = join(await tempDir(), 'silo.json')
    await writeFile(
      path,
      JSON.stringify({ schemaVersion: 1, profiles: [{ id: 'x' }], groups: [], settings: {} })
    )
    const r = await new FileStore(path).load()
    expect(r.recoveredFrom).toBe(`${path}.bak`)
    expect(r.data.profiles).toEqual([])
  })

  it('serializa escrituras concurrentes y deja la última', async () => {
    const path = join(await tempDir(), 'silo.json')
    const store = new FileStore(path)
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.save({ ...emptyStore(), settings: { browserPath: `/b/${i}` } })
      )
    )
    const saved = JSON.parse(await readFile(path, 'utf8'))
    expect(saved.settings.browserPath).toBe('/b/19')
  })

  it('migra un archivo sin schemaVersion', () => {
    expect(migrate({ profiles: [] })).toEqual({ profiles: [], schemaVersion: SCHEMA_VERSION })
  })

  const v1Profile = (n: number, name: string, start: unknown) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name,
    color: 'azul',
    emoji: '💼',
    notes: '',
    groupId: null,
    start,
    createdAt: '2026-11-01T00:00:00.000Z',
    lastOpenedAt: null
  })
  const v1 = {
    schemaVersion: 1,
    profiles: [
      v1Profile(1, 'Nueva', { kind: 'newtab' }),
      v1Profile(2, 'Correo', { kind: 'gmail' }),
      v1Profile(3, 'Drive', { kind: 'drive' }),
      v1Profile(4, 'Agenda', { kind: 'calendar' }),
      v1Profile(5, 'Ads', { kind: 'custom', url: 'https://ads.google.com' })
    ],
    groups: [],
    settings: { browserPath: '/usr/bin/chromium' }
  }

  it('migra el schema 1: la página de inicio pasa a lista de pestañas', async () => {
    const path = join(await tempDir(), 'silo.json')
    const text = JSON.stringify(v1)
    await writeFile(path, text)
    const store = new FileStore(path)
    const r = await store.load()
    expect(r.recoveredFrom).toBeNull()
    expect(r.data.schemaVersion).toBe(2)
    expect(r.data.settings.browserPath).toBe('/usr/bin/chromium')
    expect(r.data.profiles.map((p) => p.tabs)).toEqual([
      [],
      ['https://mail.google.com'],
      ['https://drive.google.com'],
      ['https://calendar.google.com'],
      ['https://ads.google.com']
    ])
    expect(r.data.profiles[0]).not.toHaveProperty('start')
    expect(r.data.profiles.map((p) => p.name)).toEqual(['Nueva', 'Correo', 'Drive', 'Agenda', 'Ads'])
  })

  it('al migrar conserva el archivo original en silo.v1.json y no lo pisa después', async () => {
    const dir = await tempDir()
    const path = join(dir, 'silo.json')
    const text = JSON.stringify(v1)
    await writeFile(path, text)
    const store = new FileStore(path)
    const { data } = await store.load()
    expect(await readFile(join(dir, 'silo.v1.json'), 'utf8')).toBe(text)
    // Ya en schema 2 no se vuelve a copiar.
    await store.save(data)
    await writeFile(join(dir, 'silo.v1.json'), 'intacto')
    await store.load()
    await writeFile(path, text)
    await store.load()
    expect(await readFile(join(dir, 'silo.v1.json'), 'utf8')).toBe('intacto')
  })

  it('un archivo ya en el schema actual no genera copia', async () => {
    const dir = await tempDir()
    const path = join(dir, 'silo.json')
    await new FileStore(path).save(emptyStore())
    await new FileStore(path).load()
    await expect(access(join(dir, 'silo.v1.json'))).rejects.toThrow()
  })
})
