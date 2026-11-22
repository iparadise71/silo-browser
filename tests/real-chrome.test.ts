import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectBrowsers, realDetectDeps } from '../src/main/browser/detect'
import { buildArgs, isProfileRunning, launch, lockPid } from '../src/main/browser/launcher'
import { tempDir } from './helpers'

/**
 * Integración con el Chrome instalado (opt-in): SILO_REAL_CHROME=1 npm test
 * Usa --headless=new para no abrir ventanas. Verifica que el SingletonLock real
 * se interpreta como «abierto» y que al cerrar Chrome vuelve a «cerrado».
 */
describe.runIf(process.env.SILO_REAL_CHROME === '1')('Chrome real', () => {
  it('detecta abierto y cerrado por SingletonLock', async () => {
    const found = (await detectBrowsers(process.platform, process.env, realDetectDeps)).find((b) => b.found)
    expect(found, 'no hay Chrome/Chromium instalado').toBeTruthy()
    const dir = join(await tempDir(), 'perfil')
    const pid = await launch(found!.path, [
      ...buildArgs({ userDataDir: dir }),
      '--headless=new',
      'about:blank'
    ])
    let open = false
    for (let i = 0; i < 40 && !open; i++) {
      await new Promise((r) => setTimeout(r, 250))
      open = await isProfileRunning(dir)
    }
    expect(open).toBe(true)
    // El PID del SingletonLock es el que Silo Browser usa para cerrar el perfil al salir.
    expect(await lockPid(dir)).toBe(pid)
    process.kill((await lockPid(dir))!, 'SIGTERM')
    let closed = false
    for (let i = 0; i < 40 && !closed; i++) {
      await new Promise((r) => setTimeout(r, 250))
      closed = !(await isProfileRunning(dir))
    }
    expect(closed).toBe(true)
  }, 30_000)
})
