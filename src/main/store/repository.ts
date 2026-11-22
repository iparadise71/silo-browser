import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  COLOR_IDS,
  GroupSchema,
  ProfileInputSchema,
  ProfilePatchSchema,
  type Group,
  type Profile,
  type ProfileInput,
  type ProfilePatch,
  type Settings,
  type StoreData
} from '@shared/model'
import { SiloError } from '@shared/ipc'
import type { FileStore } from './fileStore'

export interface RepositoryDeps {
  now?: () => Date
  uuid?: () => string
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value)
  if (!r.success) throw new SiloError('VALIDATION', r.error.issues[0]?.message ?? 'Datos no válidos.')
  return r.data
}

/** Perfiles, grupos y ajustes sobre un FileStore. Todas las escrituras persisten antes de resolver. */
export class ProfileRepository {
  private data!: StoreData
  private readonly now: () => Date
  private readonly uuid: () => string

  constructor(
    private readonly store: FileStore,
    deps: RepositoryDeps = {}
  ) {
    this.now = deps.now ?? (() => new Date())
    this.uuid = deps.uuid ?? randomUUID
  }

  /** Carga el archivo. Devuelve la ruta del respaldo si estaba corrupto. */
  async init(): Promise<string | null> {
    const { data, recoveredFrom } = await this.store.load()
    this.data = data
    return recoveredFrom
  }

  list(): Profile[] {
    return this.data.profiles.map((p) => ({ ...p }))
  }

  groups(): Group[] {
    return this.data.groups.map((g) => ({ ...g }))
  }

  settings(): Settings {
    return { ...this.data.settings }
  }

  get(id: string): Profile {
    const p = this.data.profiles.find((x) => x.id === id)
    if (!p) throw new SiloError('NOT_FOUND', 'El perfil no existe.')
    return { ...p }
  }

  private assertUniqueName(name: string, exceptId?: string) {
    const key = name.trim().toLocaleLowerCase('es')
    if (this.data.profiles.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase('es') === key)) {
      throw new SiloError('DUPLICATE_NAME', `Ya tienes un perfil llamado «${name.trim()}».`)
    }
  }

  private assertGroup(groupId: string | null | undefined) {
    if (groupId && !this.data.groups.some((g) => g.id === groupId)) {
      throw new SiloError('NOT_FOUND', 'El grupo no existe.')
    }
  }

  private async commit(next: StoreData) {
    await this.store.save(next)
    this.data = next
  }

  async create(input: ProfileInput): Promise<Profile> {
    const v = parseOrThrow(ProfileInputSchema, input)
    this.assertUniqueName(v.name)
    this.assertGroup(v.groupId)
    const profile: Profile = {
      id: this.uuid(),
      ...v,
      createdAt: this.now().toISOString(),
      lastOpenedAt: null
    }
    await this.commit({ ...this.data, profiles: [...this.data.profiles, profile] })
    return { ...profile }
  }

  async update(id: string, patch: ProfilePatch): Promise<Profile> {
    const current = this.get(id)
    const v = parseOrThrow(ProfilePatchSchema, patch)
    // `partial()` de Zod conserva los defaults: solo aplicamos las claves enviadas.
    const sent = Object.fromEntries(Object.entries(v).filter(([k]) => k in (patch as object)))
    if (sent.name !== undefined) this.assertUniqueName(sent.name as string, id)
    if ('groupId' in sent) this.assertGroup(sent.groupId as string | null)
    const next: Profile = { ...current, ...sent }
    await this.commit({ ...this.data, profiles: this.data.profiles.map((p) => (p.id === id ? next : p)) })
    return { ...next }
  }

  async remove(id: string): Promise<Profile> {
    const p = this.get(id)
    await this.commit({ ...this.data, profiles: this.data.profiles.filter((x) => x.id !== id) })
    return p
  }

  /** Copia la configuración con un nombre libre. La sesión no se copia. */
  async duplicate(id: string): Promise<Profile> {
    const src = this.get(id)
    const base = `${src.name} (copia)`.slice(0, 40)
    let name = base
    for (
      let i = 2;
      this.data.profiles.some((p) => p.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'));
      i++
    ) {
      name = `${base.slice(0, 36)} ${i}`
    }
    return this.create({
      name,
      color: src.color,
      emoji: src.emoji,
      notes: src.notes,
      groupId: src.groupId,
      tabs: src.tabs
    })
  }

  async markOpened(id: string): Promise<void> {
    this.get(id)
    const at = this.now().toISOString()
    await this.commit({
      ...this.data,
      profiles: this.data.profiles.map((p) => (p.id === id ? { ...p, lastOpenedAt: at } : p))
    })
  }

  async moveToGroup(ids: string[], groupId: string | null): Promise<void> {
    this.assertGroup(groupId)
    const set = new Set(ids)
    await this.commit({
      ...this.data,
      profiles: this.data.profiles.map((p) => (set.has(p.id) ? { ...p, groupId } : p))
    })
  }

  async createGroup(name: string): Promise<Group> {
    const clean = name.trim()
    if (this.data.groups.some((g) => g.name.toLocaleLowerCase('es') === clean.toLocaleLowerCase('es'))) {
      throw new SiloError('DUPLICATE_NAME', `Ya existe el grupo «${clean}».`)
    }
    const color = COLOR_IDS[(this.data.groups.length + 4) % COLOR_IDS.length]!
    const group = parseOrThrow(GroupSchema, { id: this.uuid(), name: clean, color })
    await this.commit({ ...this.data, groups: [...this.data.groups, group] })
    return { ...group }
  }

  /** Borra el grupo; sus perfiles quedan sin grupo. */
  async removeGroup(id: string): Promise<void> {
    this.assertGroup(id)
    await this.commit({
      ...this.data,
      groups: this.data.groups.filter((g) => g.id !== id),
      profiles: this.data.profiles.map((p) => (p.groupId === id ? { ...p, groupId: null } : p))
    })
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const settings = { ...this.data.settings, ...patch }
    await this.commit({ ...this.data, settings })
    return { ...settings }
  }
}
