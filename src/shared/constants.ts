/**
 * Constantes compartidas sin dependencias: el renderer las importa sin arrastrar Zod.
 */

export const COLORS = [
  // Los ids se guardan en silo.json: no cambian aunque cambie el tono.
  { id: 'petroleo', name: 'Cian', hex: '#22c3e6' },
  { id: 'azul', name: 'Azul', hex: '#3b7bf6' },
  { id: 'lavanda', name: 'Violeta', hex: '#8b6cf6' },
  { id: 'rosa', name: 'Rosa', hex: '#e2589b' },
  { id: 'arcilla', name: 'Rojo', hex: '#ef5350' },
  { id: 'mostaza', name: 'Ámbar', hex: '#f0a830' },
  { id: 'salvia', name: 'Verde', hex: '#2fbf88' },
  { id: 'piedra', name: 'Gris', hex: '#8a96ad' }
] as const

export type ColorId = (typeof COLORS)[number]['id']
export const COLOR_IDS = COLORS.map((c) => c.id) as [ColorId, ...ColorId[]]
export const colorHex = (id: string): string => COLORS.find((c) => c.id === id)?.hex ?? '#8a96ad'

export const EMOJIS = [
  '💼',
  '🏠',
  '📧',
  '📊',
  '🛒',
  '🧪',
  '🎧',
  '📁',
  '⭐',
  '🎓',
  '💳',
  '📣',
  '🎨',
  '💻',
  '🏦',
  '✈️',
  '🎮',
  '📷',
  '🔒',
  '🌐',
  '🧾',
  '🚀',
  '❤️',
  '🐶'
] as const

/** Máximo de pestañas de inicio por perfil. */
export const MAX_TABS = 10

/** Atajos para añadir una pestaña de inicio. Los ids coinciden con el `start.kind` del schema 1. */
export const TAB_PRESETS = [
  { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com' },
  { id: 'drive', name: 'Drive', url: 'https://drive.google.com' },
  { id: 'calendar', name: 'Calendar', url: 'https://calendar.google.com' }
] as const

/**
 * Deja lista una URL escrita a mano: añade https:// si falta y comprueba lo mismo que el schema
 * (http o https, dominio con punto). null si no es válida.
 */
export function normalizeTabUrl(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.includes('.') && withScheme.length <= 2048 ? withScheme : null
  } catch {
    return null
  }
}
