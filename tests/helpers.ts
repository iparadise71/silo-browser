import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { FileStore } from '../src/main/store/fileStore'
import { ProfileRepository } from '../src/main/store/repository'

const dirs: string[] = []

export async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'silo-test-'))
  dirs.push(d)
  return d
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

/** Repositorio sobre un directorio temporal, con uuid y reloj deterministas. */
export async function makeRepo(dir?: string) {
  const base = dir ?? (await tempDir())
  let n = 0
  let t = Date.parse('2026-11-08T13:00:00.000Z')
  const repo = new ProfileRepository(new FileStore(join(base, 'silo.json')), {
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    now: () => new Date((t += 60_000))
  })
  await repo.init()
  return { repo, dir: base }
}
