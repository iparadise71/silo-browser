#!/usr/bin/env node
/**
 * Prueba de humo: abre la app compilada (out/) con datos de ejemplo en una carpeta
 * temporal, guarda una captura de la ventana y sale. No toca los datos reales.
 *
 *   npm run build && npm run smoke -- [--empty] [--out captura.png]
 *
 * En Linux sin pantalla, ejecútalo con `xvfb-run -a`.
 */
import { spawn } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  existsSync,
  rmSync,
  readdirSync,
  readFileSync
} from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const args = process.argv.slice(2)
const empty = args.includes('--empty')
const outIdx = args.indexOf('--out')
const out = resolve(outIdx >= 0 ? args[outIdx + 1] : 'smoke.png')
const jsIdx = args.indexOf('--js')
const js = jsIdx >= 0 ? args[jsIdx + 1] : ''
const keep = args.includes('--keep')
const quitCheck = args.includes('--quit')
// --quit usa un Chrome falso que se queda abierto: así se prueba que salir de la app lo cierra.
const fakeBrowser = args.includes('--fake-browser') || quitCheck

const userData = mkdtempSync(join(tmpdir(), 'silo-smoke-'))
const profilesDir = join(userData, 'profiles')
mkdirSync(profilesDir, { recursive: true })

const day = 86_400_000
const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

if (!empty) {
  const groups = [
    { id: id(101), name: 'Clientes', color: 'mostaza' },
    { id: id(102), name: 'Agencia', color: 'petroleo' }
  ]
  const p = (n, name, color, emoji, groupId, tabs, notes, last) => ({
    id: id(n),
    name,
    color,
    emoji,
    notes,
    groupId,
    tabs,
    createdAt: iso(now - 30 * day),
    lastOpenedAt: last === null ? null : iso(now - last)
  })
  const profiles = [
    p(
      1,
      'Trabajo',
      'azul',
      '💼',
      id(102),
      ['https://mail.google.com'],
      'Cuenta principal de la agencia',
      26 * 60_000
    ),
    p(2, 'Personal', 'salvia', '🏠', null, [], 'Gmail, Drive y Fotos', day - 3 * 3_600_000),
    p(
      3,
      'Cliente Norte',
      'mostaza',
      '📊',
      id(101),
      ['https://ads.google.com', 'https://analytics.google.com', 'https://mail.google.com'],
      'Google Ads y Analytics',
      5 * day
    ),
    p(
      4,
      'Cliente Sur',
      'rosa',
      '🛒',
      id(101),
      ['https://merchants.google.com'],
      'Shopify y Merchant Center',
      7 * day
    ),
    p(5, 'Pruebas QA', 'lavanda', '🧪', null, [], 'Borrar datos al terminar el sprint', 11 * day),
    p(6, 'Soporte', 'piedra', '🎧', id(102), ['https://mail.google.com'], '', null)
  ]
  let browserPath = null
  if (fakeBrowser && process.platform !== 'win32') {
    // Navegador falso: registra los argumentos en lugar de abrir Chrome.
    mkdirSync(join(userData, 'bin'))
    browserPath = join(userData, 'bin', 'chromium')
    const logOnly = `#!/bin/sh\necho "$@" >> "${join(userData, 'launch.log')}"\n`
    // Imita a Chrome: toma la carpeta con un SingletonLock <host>-<pid> y espera hasta recibir SIGTERM.
    const stayAlive = `#!/bin/sh
for a in "$@"; do case "$a" in --user-data-dir=*) D="\${a#--user-data-dir=}";; esac; done
[ -n "$D" ] || exit 1
echo $$ > "$D/fake.pid"
ln -sf "${hostname()}-$$" "$D/SingletonLock"
trap 'rm -f "$D/SingletonLock"; echo term > "$D/fake.exit"; exit 0' TERM
while true; do sleep 0.2; done
`
    writeFileSync(browserPath, quitCheck ? stayAlive : logOnly, { mode: 0o755 })
  }
  writeFileSync(
    join(userData, 'silo.json'),
    JSON.stringify({ schemaVersion: 2, profiles, groups, settings: { browserPath } }, null, 2)
  )
  for (const pr of profiles) mkdirSync(join(profilesDir, pr.id), { recursive: true })
  // «Trabajo» aparece abierto: un SingletonLock que apunta a este proceso, que sigue vivo.
  if (process.platform !== 'win32' && !quitCheck)
    symlinkSync(`${hostname()}-${process.pid}`, join(profilesDir, id(1), 'SingletonLock'))
}

const require = createRequire(import.meta.url)
const electron = require('electron')
const extra = process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : []
const env = { ...process.env }
// VS Code y otros hosts de Electron la exportan: haría arrancar Electron como Node.
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['.', ...extra], {
  stdio: 'inherit',
  env: {
    ...env,
    SILO_USER_DATA: userData,
    SILO_SMOKE_SHOT: out,
    SILO_SMOKE_DELAY: process.env.SILO_SMOKE_DELAY ?? '2000',
    SILO_SMOKE_JS: js,
    SILO_SMOKE_QUIT: quitCheck ? '1' : '',
    ELECTRON_RENDERER_URL: ''
  }
})
const timer = setTimeout(() => {
  console.error('smoke: la app no respondió en 30 s')
  child.kill('SIGKILL')
}, 30_000)
child.on('exit', (code) => {
  clearTimeout(timer)
  if (quitCheck) {
    // Cada perfil que llegó a abrirse debe haber recibido SIGTERM y su proceso ya no debe existir.
    const opened = readdirSync(profilesDir).filter((d) => existsSync(join(profilesDir, d, 'fake.pid')))
    const alive = opened.filter((d) => {
      const pid = Number(readFileSync(join(profilesDir, d, 'fake.pid'), 'utf8'))
      try {
        process.kill(pid, 0)
        process.kill(pid, 'SIGKILL')
        return true
      } catch {
        return false
      }
    })
    const termed = opened.filter((d) => existsSync(join(profilesDir, d, 'fake.exit')))
    console.log(
      `smoke-quit: abiertos=${opened.length} cerrados-con-SIGTERM=${termed.length} vivos=${alive.length}`
    )
    if (!opened.length || alive.length || termed.length !== opened.length) code = 1
  }
  if (keep) console.log(`smoke: datos en ${userData}`)
  else rmSync(userData, { recursive: true, force: true })
  if (code === 0 && existsSync(out)) {
    console.log(`smoke: OK → ${out}`)
    process.exit(0)
  }
  console.error(`smoke: falló (código ${code})`)
  process.exit(1)
})
