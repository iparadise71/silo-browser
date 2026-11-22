import type { Group, Profile } from './model'

export type StatusFilter = 'all' | 'open' | 'closed'
export type SortKey = 'recent' | 'name'

export interface FilterOptions {
  groupId: string | null
  status: StatusFilter
  query: string
  sort: SortKey
}

/** «ads.google.com/x» a partir de una URL. */
export function hostOf(url: string): string {
  try {
    const u = new URL(url)
    return (u.host + u.pathname).replace(/\/$/, '')
  } catch {
    return url
  }
}

/** Resumen de las pestañas de inicio: «nueva pestaña», «mail.google.com», «mail.google.com +2». */
export function tabsLabel(tabs: readonly string[]): string {
  if (!tabs.length) return 'nueva pestaña'
  const first = hostOf(tabs[0]!)
  return tabs.length === 1 ? first : `${first} +${tabs.length - 1}`
}

/** Filtra y ordena perfiles. Los abiertos van primero en «recientes». */
export function filterProfiles(
  profiles: Profile[],
  groups: Group[],
  running: ReadonlySet<string>,
  opts: FilterOptions
): Profile[] {
  const q = opts.query.trim().toLocaleLowerCase('es')
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? ''
  const out = profiles.filter((p) => {
    if (opts.groupId && p.groupId !== opts.groupId) return false
    const open = running.has(p.id)
    if (opts.status === 'open' && !open) return false
    if (opts.status === 'closed' && open) return false
    if (!q) return true
    return [p.name, p.notes, groupName(p.groupId), ...p.tabs.map(hostOf)]
      .join(' ')
      .toLocaleLowerCase('es')
      .includes(q)
  })
  const ts = (p: Profile) => (p.lastOpenedAt ? Date.parse(p.lastOpenedAt) : -1)
  out.sort((a, b) => {
    if (opts.sort === 'name') return a.name.localeCompare(b.name, 'es')
    const ra = running.has(a.id) ? 1 : 0
    const rb = running.has(b.id) ? 1 : 0
    return rb - ra || ts(b) - ts(a) || a.name.localeCompare(b.name, 'es')
  })
  return out
}
