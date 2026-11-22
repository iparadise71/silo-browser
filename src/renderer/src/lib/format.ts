const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const hm = (d: Date) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })

export function dayDiff(iso: string, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
}

/** «hoy 13:04», «ayer 18:20», «3 nov». */
export function when(iso: string | null, now = new Date()): string {
  if (!iso) return 'nunca abierto'
  const d = new Date(iso)
  const dd = dayDiff(iso, now)
  if (dd === 0) return `hoy ${hm(d)}`
  if (dd === 1) return `ayer ${hm(d)}`
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`
}

/** «hace 5 min», «hace 2 h». */
export function since(iso: string | null, now = new Date()): string {
  if (!iso) return ''
  const m = Math.max(1, Math.round((now.getTime() - Date.parse(iso)) / 60_000))
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  return h < 24 ? `hace ${h} h` : when(iso, now)
}

export function clock(iso: string, now = new Date()): string {
  const dd = dayDiff(iso, now)
  const d = new Date(iso)
  return dd === 0 ? hm(d) : dd === 1 ? 'ayer' : `${d.getDate()} ${MESES[d.getMonth()]}`
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
