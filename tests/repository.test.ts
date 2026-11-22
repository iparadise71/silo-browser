import { describe, expect, it } from 'vitest'
import { makeRepo } from './helpers'
import { ProfileRepository } from '../src/main/store/repository'
import { FileStore } from '../src/main/store/fileStore'
import { join } from 'node:path'

const base = { color: 'azul' as const, emoji: '💼' }

describe('ProfileRepository', () => {
  it('crea un perfil con defaults y lo persiste', async () => {
    const { repo, dir } = await makeRepo()
    const p = await repo.create({ ...base, name: '  Trabajo  ' })
    expect(p).toMatchObject({
      name: 'Trabajo',
      notes: '',
      groupId: null,
      tabs: [],
      lastOpenedAt: null
    })
    const again = new ProfileRepository(new FileStore(join(dir, 'silo.json')))
    await again.init()
    expect(again.list()).toEqual([p])
  })

  it('rechaza nombres vacíos y duplicados sin importar mayúsculas', async () => {
    const { repo } = await makeRepo()
    await repo.create({ ...base, name: 'Trabajo' })
    await expect(repo.create({ ...base, name: '   ' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(repo.create({ ...base, name: 'TRABAJO' })).rejects.toMatchObject({ code: 'DUPLICATE_NAME' })
  })

  it('valida las pestañas de inicio', async () => {
    const { repo } = await makeRepo()
    await expect(
      repo.create({ ...base, name: 'A', tabs: ['https://ok.test', 'javascript:alert(1)'] })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repo.create({ ...base, name: 'A', tabs: Array.from({ length: 11 }, (_, i) => `https://t${i}.test`) })
    ).rejects.toMatchObject({ code: 'VALIDATION', message: 'Máximo 10 pestañas.' })
    const tabs = ['https://ads.google.com', 'https://analytics.google.com']
    const ok = await repo.create({ ...base, name: 'B', tabs })
    expect(ok.tabs).toEqual(tabs)
    expect((await repo.duplicate(ok.id)).tabs).toEqual(tabs)
  })

  it('update cambia solo lo enviado', async () => {
    const { repo } = await makeRepo()
    const p = await repo.create({
      ...base,
      name: 'Personal',
      notes: 'Gmail',
      tabs: ['https://mail.google.com']
    })
    const u = await repo.update(p.id, { color: 'salvia' })
    expect(u).toMatchObject({
      name: 'Personal',
      notes: 'Gmail',
      color: 'salvia',
      tabs: ['https://mail.google.com']
    })
    await expect(repo.update(p.id, { name: '' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('permite renombrar a sí mismo con otras mayúsculas', async () => {
    const { repo } = await makeRepo()
    const p = await repo.create({ ...base, name: 'cliente' })
    expect((await repo.update(p.id, { name: 'Cliente' })).name).toBe('Cliente')
  })

  it('duplica sin sesión y con nombre libre', async () => {
    const { repo } = await makeRepo()
    const p = await repo.create({ ...base, name: 'Ventas', notes: 'n' })
    await repo.markOpened(p.id)
    const c1 = await repo.duplicate(p.id)
    const c2 = await repo.duplicate(p.id)
    expect(c1).toMatchObject({ name: 'Ventas (copia)', notes: 'n', lastOpenedAt: null })
    expect(c2.name).toBe('Ventas (copia) 2')
    expect(c1.id).not.toBe(p.id)
  })

  it('grupos: crear, mover y borrar deja perfiles sin grupo', async () => {
    const { repo } = await makeRepo()
    const g = await repo.createGroup('Clientes')
    await expect(repo.createGroup('clientes')).rejects.toMatchObject({ code: 'DUPLICATE_NAME' })
    const a = await repo.create({ ...base, name: 'A' })
    const b = await repo.create({ ...base, name: 'B' })
    await repo.moveToGroup([a.id, b.id], g.id)
    expect(repo.list().every((p) => p.groupId === g.id)).toBe(true)
    await expect(repo.moveToGroup([a.id], 'no-existe')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await repo.removeGroup(g.id)
    expect(repo.groups()).toEqual([])
    expect(repo.list().every((p) => p.groupId === null)).toBe(true)
  })

  it('markOpened guarda la fecha y remove borra', async () => {
    const { repo } = await makeRepo()
    const p = await repo.create({ ...base, name: 'X' })
    await repo.markOpened(p.id)
    expect(repo.get(p.id).lastOpenedAt).not.toBeNull()
    await repo.remove(p.id)
    expect(() => repo.get(p.id)).toThrow(/no existe/)
  })
})
