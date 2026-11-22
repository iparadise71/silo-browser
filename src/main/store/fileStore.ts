import { promises as nodeFs } from 'node:fs'
import { dirname } from 'node:path'
import { emptyStore, SCHEMA_VERSION, StoreDataSchema, TAB_PRESETS, type StoreData } from '@shared/model'

/** Subconjunto de fs que usa el store. Los tests inyectan uno en memoria o un directorio temporal. */
export interface StoreFs {
  readFile(path: string, enc: 'utf8'): Promise<string>
  writeFile(path: string, data: string, enc: 'utf8'): Promise<void>
  rename(from: string, to: string): Promise<void>
  mkdir(path: string, opts: { recursive: true }): Promise<unknown>
}

export interface LoadResult {
  data: StoreData
  /** Ruta del respaldo si el archivo estaba corrupto y se apartó. */
  recoveredFrom: string | null
}

/** Schema 1: `start` era una sola página. Schema 2: `tabs` es la lista de URLs. */
function startToTabs(start: unknown): string[] {
  if (!start || typeof start !== 'object') return []
  const { kind, url } = start as { kind?: unknown; url?: unknown }
  if (kind === 'custom') return typeof url === 'string' && url.trim() ? [url.trim()] : []
  const preset = TAB_PRESETS.find((t) => t.id === kind)
  return preset ? [preset.url] : []
}

/** Lleva datos de versiones anteriores a SCHEMA_VERSION. Un archivo sin versión se trata como la 1. */
export function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const data = raw as Record<string, unknown>
  const version = 'schemaVersion' in data ? data.schemaVersion : 1
  if (version !== 1) return raw
  const profiles = Array.isArray(data.profiles)
    ? data.profiles.map((p: unknown) => {
        if (!p || typeof p !== 'object' || 'tabs' in p) return p
        const { start, ...rest } = p as Record<string, unknown>
        return { ...rest, tabs: startToTabs(start) }
      })
    : data.profiles
  return { ...data, profiles, schemaVersion: SCHEMA_VERSION }
}

export class FileStore {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    readonly path: string,
    private readonly fs: StoreFs = nodeFs
  ) {}

  /**
   * Lee y valida el archivo. Si no existe, arranca vacío.
   * Si no parsea o no cumple el schema, lo renombra a `.bak` y arranca vacío.
   */
  async load(): Promise<LoadResult> {
    let text: string
    try {
      text = await this.fs.readFile(this.path, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { data: emptyStore(), recoveredFrom: null }
      throw err
    }
    try {
      const raw: unknown = JSON.parse(text)
      const migrated = migrate(raw)
      const parsed = StoreDataSchema.parse(migrated)
      // La primera escritura reemplaza el archivo: antes se guarda el original, una sola vez.
      if (migrated !== raw) await this.keepOriginal(raw, text)
      return { data: parsed, recoveredFrom: null }
    } catch {
      const backup = `${this.path}.bak`
      await this.fs.rename(this.path, backup)
      return { data: emptyStore(), recoveredFrom: backup }
    }
  }

  /** Copia del archivo previo a una migración: `silo.json` → `silo.v1.json`. No pisa una copia anterior. */
  private async keepOriginal(raw: unknown, text: string): Promise<void> {
    const version = (raw as { schemaVersion?: unknown }).schemaVersion ?? 1
    const copy = this.path.replace(/(\.json)?$/, `.v${String(version)}.json`)
    try {
      await this.fs.readFile(copy, 'utf8')
    } catch {
      await this.fs.writeFile(copy, text, 'utf8')
    }
  }

  /** Escritura atómica (tmp + rename), serializada para no pisar escrituras concurrentes. */
  save(data: StoreData): Promise<void> {
    const run = async () => {
      const valid = StoreDataSchema.parse(data)
      await this.fs.mkdir(dirname(this.path), { recursive: true })
      const tmp = `${this.path}.tmp`
      await this.fs.writeFile(tmp, JSON.stringify(valid, null, 2), 'utf8')
      await this.fs.rename(tmp, this.path)
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => undefined)
    return next
  }
}
