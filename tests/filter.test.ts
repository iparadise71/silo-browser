import { describe, expect, it } from 'vitest'
import { filterProfiles, hostOf, tabsLabel } from '@shared/filter'
import { normalizeTabUrl } from '@shared/constants'
import type { Profile } from '@shared/model'

const mk = (id: string, name: string, extra: Partial<Profile> = {}): Profile => ({
  id,
  name,
  color: 'azul',
  emoji: '💼',
  notes: '',
  groupId: null,
  tabs: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  lastOpenedAt: null,
  ...extra
})

const profiles = [
  mk('a', 'Personal', { lastOpenedAt: '2026-11-07T10:00:00.000Z' }),
  mk('b', 'Cliente Norte', { groupId: 'g1', notes: 'Google Ads', lastOpenedAt: '2026-11-03T10:00:00.000Z' }),
  mk('c', 'Trabajo', { tabs: ['https://mail.google.com', 'https://drive.google.com'] }),
  mk('d', 'Ánimo', { tabs: ['https://ads.google.com/x/'] })
]
const groups = [{ id: 'g1', name: 'Clientes', color: 'mostaza' as const }]
const opts = { groupId: null, status: 'all' as const, query: '', sort: 'recent' as const }

describe('filterProfiles', () => {
  it('ordena abiertos primero y luego por última apertura', () => {
    const r = filterProfiles(profiles, groups, new Set(['c']), opts).map((p) => p.id)
    expect(r).toEqual(['c', 'a', 'b', 'd'])
  })

  it('ordena por nombre con reglas del español', () => {
    const r = filterProfiles(profiles, groups, new Set(), { ...opts, sort: 'name' }).map((p) => p.name)
    expect(r).toEqual(['Ánimo', 'Cliente Norte', 'Personal', 'Trabajo'])
  })

  it('busca en nombre, notas, grupo y pestañas de inicio', () => {
    const q = (query: string) =>
      filterProfiles(profiles, groups, new Set(), { ...opts, query }).map((p) => p.id)
    expect(q('ads')).toEqual(['b', 'd'])
    expect(q('clientes')).toEqual(['b'])
    expect(q('mail.google')).toEqual(['c'])
    expect(q('drive.google')).toEqual(['c'])
  })

  it('filtra por grupo y estado', () => {
    expect(filterProfiles(profiles, groups, new Set(), { ...opts, groupId: 'g1' }).map((p) => p.id)).toEqual([
      'b'
    ])
    expect(
      filterProfiles(profiles, groups, new Set(['a']), { ...opts, status: 'open' }).map((p) => p.id)
    ).toEqual(['a'])
    expect(filterProfiles(profiles, groups, new Set(['a']), { ...opts, status: 'closed' })).toHaveLength(3)
  })

  it('hostOf y tabsLabel muestran el destino legible', () => {
    expect(hostOf('https://ads.google.com/x/')).toBe('ads.google.com/x')
    expect(tabsLabel([])).toBe('nueva pestaña')
    expect(tabsLabel(['https://ads.google.com/x/'])).toBe('ads.google.com/x')
    expect(tabsLabel(['https://mail.google.com', 'https://a.test', 'https://b.test'])).toBe(
      'mail.google.com +2'
    )
  })

  it('normalizeTabUrl completa el esquema y rechaza lo que el schema rechazaría', () => {
    expect(normalizeTabUrl('  ads.google.com/x ')).toBe('https://ads.google.com/x')
    expect(normalizeTabUrl('http://intranet.test')).toBe('http://intranet.test')
    expect(normalizeTabUrl('')).toBeNull()
    expect(normalizeTabUrl('localhost')).toBeNull()
    expect(normalizeTabUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeTabUrl('dos palabras.com')).toBeNull()
  })
})
