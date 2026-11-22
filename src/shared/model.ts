import { z } from 'zod'

/** Versión del archivo de datos. Sube cuando cambia la forma de StoreData. */
export const SCHEMA_VERSION = 2

import { COLOR_IDS, MAX_TABS } from './constants'

export * from './constants'

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v)
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.')
    } catch {
      return false
    }
  }, 'URL no válida: usa http:// o https://')

/** Pestañas con las que abre un perfil, en orden. Vacía = nueva pestaña. */
export const TabsSchema = z.array(httpUrl).max(MAX_TABS, `Máximo ${MAX_TABS} pestañas.`)

export const ProfileNameSchema = z
  .string()
  .trim()
  .min(1, 'Escribe un nombre.')
  .max(40, 'Máximo 40 caracteres.')

export const ProfileSchema = z.object({
  id: z.uuid(),
  name: ProfileNameSchema,
  color: z.enum(COLOR_IDS),
  emoji: z.string().min(1).max(16),
  notes: z.string().max(500),
  groupId: z.string().nullable(),
  tabs: TabsSchema,
  createdAt: z.iso.datetime(),
  lastOpenedAt: z.iso.datetime().nullable()
})
export type Profile = z.infer<typeof ProfileSchema>

export const GroupSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(24),
  color: z.enum(COLOR_IDS)
})
export type Group = z.infer<typeof GroupSchema>

export const SettingsSchema = z.object({
  /** Ruta del ejecutable elegido. null = el primero detectado. */
  browserPath: z.string().nullable()
})
export type Settings = z.infer<typeof SettingsSchema>

export const StoreDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  profiles: z.array(ProfileSchema),
  groups: z.array(GroupSchema),
  settings: SettingsSchema
})
export type StoreData = z.infer<typeof StoreDataSchema>

export const emptyStore = (): StoreData => ({
  schemaVersion: SCHEMA_VERSION,
  profiles: [],
  groups: [],
  settings: { browserPath: null }
})

/* ---------- Entradas de la API ---------- */

export const ProfileInputSchema = z.object({
  name: ProfileNameSchema,
  color: z.enum(COLOR_IDS),
  emoji: z.string().min(1).max(16),
  notes: z.string().trim().max(500).default(''),
  groupId: z.string().nullable().default(null),
  tabs: TabsSchema.default([])
})
export type ProfileInput = z.input<typeof ProfileInputSchema>

export const ProfilePatchSchema = ProfileInputSchema.partial()
export type ProfilePatch = z.input<typeof ProfilePatchSchema>

/* ---------- Navegadores ---------- */

export interface BrowserCandidate {
  id: string
  name: string
  path: string
  version: string | null
  found: boolean
  /** Aviso para el usuario, por ejemplo Chromium en snap. */
  warning?: string
}

export interface BrowserState {
  candidates: BrowserCandidate[]
  /** Navegador que se usa al abrir; null si no hay ninguno. */
  selected: BrowserCandidate | null
}

/* ---------- Estado y eventos ---------- */

export interface Snapshot {
  profiles: Profile[]
  groups: Group[]
  running: string[]
}

export type ActivityKind = 'opened' | 'window' | 'closed' | 'created' | 'deleted' | 'error'

export interface ActivityEntry {
  id: number
  at: string
  kind: ActivityKind
  profileId: string | null
  /** Nombre del perfil en el momento del evento (sobrevive si se elimina). */
  profileName: string
  detail: string
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  dataDir: string
  profilesDir: string
}
