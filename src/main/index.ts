import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { EventName, Events } from '@shared/ipc'
import { FileStore } from './store/fileStore'
import { ProfileRepository } from './store/repository'
import { SiloService } from './service'
import { realDetectDeps } from './browser/detect'
import { registerIpc } from './ipc'
import { checkForUpdates } from './updater'

const CHROME_DOWNLOAD = 'https://www.google.com/chrome/'
const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL

// Datos en <appData>/silo-browser (no en «Silo»), como documenta el análisis.
// SILO_USER_DATA permite pruebas aisladas sin tocar los datos reales.
app.setPath('userData', process.env.SILO_USER_DATA || join(app.getPath('appData'), 'silo-browser'))

let win: BrowserWindow | null = null
/** true cuando ya se cerraron los perfiles y la app puede terminar. */
let quitting = false
/** Pide confirmación, cierra los perfiles abiertos y sale. Se define cuando el servicio existe. */
let requestQuit: () => Promise<void> = async () => {
  quitting = true
  app.quit()
}

function send<E extends EventName>(event: E, payload?: Events[E]) {
  if (win && !win.isDestroyed()) win.webContents.send(event, payload)
}

function createWindow() {
  const mac = process.platform === 'darwin'
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 880,
    minHeight: 580,
    show: false,
    title: 'Silo Browser',
    backgroundColor: '#0b1120',
    titleBarStyle: mac ? 'hiddenInset' : 'default',
    trafficLightPosition: mac ? { x: 18, y: 21 } : undefined,
    autoHideMenuBar: !mac,
    icon: process.platform === 'linux' ? join(__dirname, '../../build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  })

  // La ventana no navega fuera de la app ni abre ventanas nuevas.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault()
  })
  // Cerrar la ventana cierra la app (también en macOS) y, con ella, los perfiles abiertos.
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    void requestQuit()
  })
  win.once('ready-to-show', () => {
    if (!process.env.SILO_SMOKE_SHOT) win?.show()
  })

  if (isDev) void win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  const shot = process.env.SILO_SMOKE_SHOT
  if (shot) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(
        async () => {
          // Solo para pruebas: guion que interactúa con la interfaz antes de la captura.
          const js = process.env.SILO_SMOKE_JS
          if (js) {
            try {
              const result = await win!.webContents.executeJavaScript(`(async () => { ${js} })()`)
              if (result !== undefined) console.log(`smoke-js: ${JSON.stringify(result)}`)
            } catch (err) {
              console.error(`smoke-js error: ${(err as Error).message}`)
              process.exitCode = 2
            }
            await new Promise((r) => setTimeout(r, 700))
          }
          const img = await win!.webContents.capturePage()
          await fs.writeFile(shot, img.toPNG())
          // Prueba de salida: recorre el mismo camino que ⌘Q (sin el diálogo de confirmación).
          if (process.env.SILO_SMOKE_QUIT) void requestQuit()
          else app.exit(Number(process.exitCode ?? 0))
        },
        Number(process.env.SILO_SMOKE_DELAY ?? 1500)
      )
    })
  }
}

function buildMenu() {
  const mac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: 'Silo Browser',
            submenu: [
              { role: 'about' as const, label: 'Acerca de Silo Browser' },
              { type: 'separator' as const },
              { label: 'Ajustes…', accelerator: 'Cmd+,', click: () => send('menu:settings') },
              { type: 'separator' as const },
              { role: 'hide' as const, label: 'Ocultar Silo Browser' },
              { role: 'hideOthers' as const, label: 'Ocultar otros' },
              { role: 'unhide' as const, label: 'Mostrar todo' },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Salir de Silo Browser' }
            ]
          }
        ]
      : []),
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nuevo perfil', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new-profile') },
        ...(!mac
          ? [
              { label: 'Ajustes', accelerator: 'Ctrl+,', click: () => send('menu:settings') },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Salir' }
            ]
          : [{ role: 'close' as const, label: 'Cerrar ventana' }])
      ]
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        ...(isDev
          ? [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }]
          : [])
      ]
    },
    { role: 'windowMenu', label: 'Ventana' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  await app.whenReady()

  const dataDir = app.getPath('userData')
  const profilesDir = join(dataDir, 'profiles')
  await fs.mkdir(profilesDir, { recursive: true })

  const repo = new ProfileRepository(new FileStore(join(dataDir, 'silo.json')))
  const recovered = await repo.init()

  const service = new SiloService({
    repo,
    profilesDir,
    platform: process.platform,
    env: process.env,
    detect: realDetectDeps
  })
  if (recovered)
    service.logSystem('error', `El archivo de datos estaba dañado. Se guardó una copia en ${recovered}.`)

  service.on('state', (s) => send('state:changed', s))
  service.on('activity', (a) => send('activity:added', a))

  registerIpc(
    {
      'profiles:snapshot': () => service.snapshot(),
      'profiles:create': (input) => service.create(input),
      'profiles:update': (id, patch) => service.update(id, patch),
      'profiles:remove': (id, opts) => service.remove(id, opts.wipeData),
      'profiles:duplicate': (id) => service.duplicate(id),
      'profiles:move': (ids, groupId) => service.move(ids, groupId),
      'profiles:open': (id) => service.open(id),
      'profiles:stop': (ids) => service.stopProfiles(ids),
      'profiles:reveal': async (id) => {
        const dir = service.profileDir(id)
        await fs.mkdir(dir, { recursive: true })
        await shell.openPath(dir)
      },
      'groups:create': (name) => service.createGroup(name),
      'groups:remove': (id) => service.removeGroup(id),
      'browsers:state': (refresh) => service.browserState(refresh ?? false),
      'browsers:select': (path) => service.selectBrowser(path),
      'browsers:pick': async () => {
        const mac = process.platform === 'darwin'
        const res = await dialog.showOpenDialog(win!, {
          title: 'Elige el navegador',
          buttonLabel: 'Usar este navegador',
          defaultPath: mac ? '/Applications' : process.platform === 'linux' ? '/usr/bin' : undefined,
          properties: ['openFile', 'treatPackageAsDirectory'],
          filters: process.platform === 'win32' ? [{ name: 'Programas', extensions: ['exe'] }] : undefined
        })
        if (res.canceled || !res.filePaths[0]) return null
        let path = res.filePaths[0]
        // En macOS se puede elegir el .app: se usa su binario.
        const appMatch = path.match(/^(.*)\/([^/]+)\.app$/)
        if (appMatch) path = `${path}/Contents/MacOS/${appMatch[2]}`
        return service.selectBrowser(path)
      },
      'app:info': () => ({ version: app.getVersion(), platform: process.platform, dataDir, profilesDir }),
      'app:revealData': async () => {
        await shell.openPath(profilesDir)
      },
      'app:downloadChrome': async () => {
        await shell.openExternal(CHROME_DOWNLOAD)
      },
      'activity:list': () => service.activity()
    },
    (e) => !!win && e.sender === win.webContents
  )

  let pending = false
  requestQuit = async () => {
    if (pending || quitting) return
    pending = true
    try {
      await service.poll()
      const n = service.snapshot().running.length
      if (n && win && !win.isDestroyed() && !process.env.SILO_SMOKE_QUIT) {
        const { response } = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['Cerrar todo', 'Cancelar'],
          defaultId: 0,
          cancelId: 1,
          message:
            n === 1
              ? '¿Cerrar Silo Browser y el perfil abierto?'
              : `¿Cerrar Silo Browser y los ${n} perfiles abiertos?`,
          detail: 'Chrome guarda la sesión de cada perfil antes de cerrarse.'
        })
        if (response === 1) return
      }
      service.stop()
      if (n) {
        const r = await service.closeAll()
        if (r.failed.length) console.warn('[quit] no se pudieron cerrar:', r.failed.join(', '))
      }
      quitting = true
      app.quit()
    } finally {
      pending = false
    }
  }
  app.on('before-quit', (e) => {
    if (quitting) return
    e.preventDefault()
    void requestQuit()
  })

  buildMenu()
  createWindow()
  service.start()
  void checkForUpdates((msg) => service.logSystem('opened', msg))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else win?.show()
  })
}

// Los Chrome se lanzan desacoplados (detached + unref); al salir, requestQuit los cierra uno a uno.
app.on('window-all-closed', () => {
  app.quit()
})

void main()
