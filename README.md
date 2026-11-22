# Silo Browser

App de escritorio que gestiona perfiles de Chrome totalmente aislados. Cada perfil es una carpeta `--user-data-dir` propia, con su cuenta de Google, cookies, historial y extensiones, y se abre con un clic.

_Isolated Chrome profiles, each with its own account, session and startup tabs. One click to open._

Plataformas: **macOS** y **Ubuntu**. Para **Windows** se publica un instalador, pero esa plataforma no se ha probado todavía.

- **Gratis para uso no comercial.** Licencia [PolyForm Noncommercial 1.0.0](LICENSE.md). Ver [Licencia](#licencia).
- **Generado con IA.** El código, los tests y la documentación se escribieron con asistencia de inteligencia artificial (Claude, de Anthropic), dirigidos y revisados por una persona. Ver [Generado con IA](#generado-con-ia).

Documentación del producto en [docs/](docs/README.md): epic, análisis, benchmark y mockups.

## Instalar

Descarga el instalador de tu sistema desde [Releases](https://github.com/iparadise71/silo-browser/releases/latest). Necesitas tener instalado Chrome, Chromium, Brave o Edge: Silo Browser no trae navegador, abre el tuyo.

| Sistema               | Archivo                                              | Cómo instalar                                                             |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| macOS (Apple Silicon) | `Silo-Browser-<versión>-arm64.dmg`                   | Abre el `.dmg` y arrastra la app a Aplicaciones                           |
| macOS (Intel)         | `Silo-Browser-<versión>-x64.dmg`                     | Igual                                                                     |
| Ubuntu / Debian       | `Silo-Browser-<versión>-amd64.deb` (o `arm64`)       | `sudo apt install ./Silo-Browser-<versión>-amd64.deb`                     |
| Linux (cualquiera)    | `Silo-Browser-<versión>-x86_64.AppImage` (o `arm64`) | `chmod +x` y ejecutar. Es el único formato de Linux que se actualiza solo |
| Windows 10/11 (x64)   | `Silo-Browser-<versión>-x64-setup.exe`               | Ejecuta el instalador. **Sin probar**                                     |

**macOS: la app no está firmada con un certificado de Apple.** La primera vez macOS la bloquea. Ábrela una vez, ve a Ajustes del Sistema › Privacidad y seguridad y pulsa «Abrir igualmente». Si dice que está dañada, ejecuta `xattr -dr com.apple.quarantine "/Applications/Silo Browser.app"`. En macOS las versiones nuevas se descargan a mano.

**Windows:** el instalador tampoco está firmado, así que SmartScreen muestra un aviso («Más información › Ejecutar de todas formas»).

## Desarrollo

Requisitos: Node 22 o superior y Chrome, Chromium, Brave o Edge instalado.

```bash
npm install
npm run dev          # app con recarga en caliente
npm run check        # lint + tipos + tests
```

| Script                    | Qué hace                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`             | Electron con recarga en caliente (electron-vite)                                                                                            |
| `npm run build`           | Compila main, preload y renderer en `out/`                                                                                                  |
| `npm start`               | Abre el build de `out/`                                                                                                                     |
| `npm test`                | Tests unitarios (Vitest)                                                                                                                    |
| `npm run test:chrome`     | Integración con el Chrome instalado: abre uno headless y verifica el `SingletonLock`                                                        |
| `npm run smoke`           | Abre la app compilada con datos de ejemplo en una carpeta temporal y guarda una captura. En Linux sin pantalla: `xvfb-run -a npm run smoke` |
| `npm run dist:mac`        | `Silo-Browser-<versión>-<arch>.dmg` (Apple Silicon e Intel), con firma ad-hoc                                                               |
| `npm run dist:mac:signed` | `.dmg` firmado con el certificado del llavero                                                                                               |
| `npm run dist:linux`      | AppImage y `.deb` (x64 y arm64)                                                                                                             |
| `npm run dist:win`        | Instalador `.exe` (NSIS, x64). Hay que ejecutarlo en Windows                                                                                |

`npm run smoke -- --quit` abre perfiles con un Chrome falso, sale de la app y verifica que todos se cerraron. `npm run smoke -- --fake-browser` usa un navegador falso que registra argumentos, para probar «Abrir» sin abrir ventanas. `--js "<código>"` ejecuta un guion en la ventana antes de la captura.

Si corres comandos desde la terminal integrada de VS Code, puede venir exportada `ELECTRON_RUN_AS_NODE=1`; `npm run smoke` la quita, pero para `npm start` usa `env -u ELECTRON_RUN_AS_NODE npm start`.

## Cómo funciona

```text
src/
  main/            proceso main (Node)
    store/         FileStore (JSON atómico, .bak si está corrupto) y ProfileRepository
    browser/       detección de navegadores, lanzador, estado por SingletonLock
    service.ts     reglas: abrir, eliminar, sondeo abierto/cerrado, actividad
    ipc.ts         canales tipados con validación Zod en la frontera
    updater.ts     auto-update (activo cuando se configure `publish`)
  preload/         API mínima expuesta con contextBridge
  renderer/        React + Tailwind (interfaz del mockup v4)
  shared/          tipos, schemas, constantes y filtros compartidos
tests/             Vitest
```

- **Abrir** ejecuta el binario con `--user-data-dir=<datos>/profiles/<id> --no-first-run --no-default-browser-check [url…]`, desacoplado (`detached` + `unref`).
- **Pestañas de inicio:** cada perfil guarda hasta 10 URLs (`tabs`) y Chrome abre una pestaña por cada una, en orden. Sin ninguna abre una nueva pestaña. Si en ese perfil Chrome está configurado en «Continuar donde lo dejaste», las pestañas de inicio se suman a las restauradas.
- **Abrir un grupo** (botón «Abrir grupo» con el grupo seleccionado, o clic derecho sobre el grupo) abre todos sus perfiles cerrados, cada uno con sus pestañas; con más de 8 pide confirmación. El mismo menú tiene «Detener».
- **Detener un perfil** (botón ■ de la tarjeta, menú «⋯ › Detener perfil», tecla `S` o «Detener N» con varios seleccionados) cierra por completo su Chrome, con todas sus ventanas, por el mismo camino que al salir.
- **Salir de Silo Browser cierra los perfiles abiertos** (`⌘Q`, Salir o cerrar la ventana, también en macOS). Si hay perfiles abiertos pide confirmación; luego envía SIGTERM al PID del `SingletonLock` de cada uno para que Chrome guarde la sesión y, si alguno no termina en 6 s, lo fuerza con SIGKILL. En Windows usa el PID del lanzamiento. Sin remote debugging ni `--enable-automation`.
- **Abierto o cerrado** se decide leyendo el `SingletonLock` de la carpeta (`<host>-<pid>`) cada 2 s, no por el PID que lanzó la app. Si el perfil ya está abierto, «Nueva ventana» lanza con `--new-window` y el Chrome existente la abre.
- **Datos** en `~/Library/Application Support/silo-browser/` (macOS) o `~/.config/silo-browser/` (Ubuntu): `silo.json` (perfiles, grupos, ajustes; `schemaVersion` 2) y `profiles/<id>/`. Al migrar desde el schema 1 (una sola página de inicio por perfil) el archivo original queda en `silo.v1.json`.
- **Identidad:** ícono Monograma S ([build/icon.svg](build/icon.svg)) y paleta Glaciar (azul noche, acento cian; azul en tema claro). Las propuestas descartadas están en [build/icon-proposals/](build/icon-proposals/).
- **Seguridad del renderer:** `contextIsolation`, `sandbox`, sin `nodeIntegration`, CSP estricta en el build, navegación y ventanas nuevas bloqueadas, IPC validado y solo desde la ventana propia.

## Ubuntu

- Instala Chrome desde el `.deb` de Google o Chromium/Brave/Edge desde sus repositorios. **El Chromium de snap** (el de `apt install chromium` en Ubuntu) puede no tener permiso para escribir la carpeta de Silo Browser por el confinamiento de snap; la app lo detecta y lo avisa en Ajustes.
- El `.deb` deja `chrome-sandbox` con SUID (necesario desde Ubuntu 24.04 por las restricciones de AppArmor). La AppImage, si no arranca, se puede abrir con `--no-sandbox`.

## Alcance actual

Historias H1–H8 del [epic](docs/epic.md), más grupos (con «Abrir grupo»), pestañas de inicio por perfil, selección múltiple y panel de actividad. Quedan fuera por ahora la cuenta de Google visible y «Cerrar Chrome» (ver [benchmark](docs/benchmark-multizen.md#para-validar-antes-de-construir)).

Pendiente, fuera del código:

- **Firma y notarización de macOS.** Cargar el certificado Developer ID y las credenciales de Apple como secrets del repositorio (`MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) y poner `notarize: true`. Con eso desaparece el aviso de macOS y se puede activar el auto-update allí.
- **Probar en Windows.** El instalador se genera, pero abrir, detectar y detener perfiles no se ha verificado en esa plataforma.
- **Prueba manual de la definición de terminado:** login de Google en 3 perfiles a la vez sobre el build empaquetado, en macOS y Ubuntu.

## Ramas y versiones

| Rama      | Para qué                                                                    |
| --------- | --------------------------------------------------------------------------- |
| `develop` | Trabajo diario. Es la rama por defecto y a la que van los pull requests     |
| `release` | Lo publicado. Solo recibe merges desde `develop` cuando se saca una versión |

Para publicar una versión:

```bash
npm version <patch|minor|major> --no-git-tag-version   # en develop; luego commit
git checkout release && git merge --ff-only develop
git tag v<versión> && git push origin release develop v<versión>
```

El tag `v*` dispara el workflow de [release](.github/workflows/release.yml): compila en macOS, Ubuntu y Windows y adjunta los instaladores a un GitHub Release. El workflow de [CI](.github/workflows/ci.yml) corre lint, tipos, tests y la prueba de humo en cada push a `develop` o `release` y en cada pull request.

## Generado con IA

Este proyecto se construyó con asistencia de inteligencia artificial: el código, los tests y la documentación los escribió Claude (Anthropic) a través de Claude Code, a partir de las decisiones, las pruebas y la revisión de una persona. Tenlo en cuenta al evaluarlo: revisa el código antes de confiarle algo importante y reporta lo que encuentres en [Issues](https://github.com/iparadise71/silo-browser/issues).

Se entrega tal cual, sin garantía de ningún tipo (ver la licencia).

## Licencia

[PolyForm Noncommercial License 1.0.0](LICENSE.md). En resumen, y sin sustituir al texto de la licencia:

- **Puedes** usarlo, copiarlo, modificarlo y redistribuirlo gratis para fines no comerciales: uso personal, estudio, investigación, organizaciones sin fines de lucro, educativas y públicas.
- **No puedes** usarlo con fines comerciales: venderlo, cobrar por él o incluirlo en un producto o servicio de pago.
- Al redistribuirlo debes incluir la licencia y el aviso de copyright.

Para un uso comercial, abre un [issue](https://github.com/iparadise71/silo-browser/issues) para pedir permiso.

Silo Browser no está afiliado a Google. Chrome y Google son marcas de Google LLC.

## Software de terceros

Para **usar** la app solo necesitas un navegador basado en Chromium instalado (Chrome, Chromium, Brave o Edge). No se incluye ni se redistribuye ninguno.

La app empaquetada incluye:

| Componente                                                      | Para qué                      | Licencia |
| --------------------------------------------------------------- | ----------------------------- | -------- |
| [Electron](https://www.electronjs.org) (con Chromium y Node.js) | Ventana y proceso de la app   | MIT      |
| [React](https://react.dev) y React DOM                          | Interfaz                      | MIT      |
| [Tailwind CSS](https://tailwindcss.com)                         | Estilos                       | MIT      |
| [Zod](https://zod.dev)                                          | Validación de datos y del IPC | MIT      |
| [electron-updater](https://www.electron.build/auto-update)      | Actualizaciones automáticas   | MIT      |
| [Manrope](https://github.com/sharanda/manrope) (vía Fontsource) | Tipografía de la interfaz     | OFL-1.1  |
| [IBM Plex Mono](https://github.com/IBM/plex) (vía Fontsource)   | Tipografía monoespaciada      | OFL-1.1  |

Para **desarrollar y compilar** hacen falta además Node 22 o superior y estas herramientas, que se instalan con `npm install`:

| Herramienta                                                           | Para qué                                       | Licencia   |
| --------------------------------------------------------------------- | ---------------------------------------------- | ---------- |
| [TypeScript](https://www.typescriptlang.org)                          | Lenguaje                                       | Apache-2.0 |
| [Vite](https://vite.dev) y [electron-vite](https://electron-vite.org) | Compilación y recarga en caliente              | MIT        |
| [electron-builder](https://www.electron.build)                        | Instaladores `.dmg`, `.deb`, AppImage y `.exe` | MIT        |
| [Vitest](https://vitest.dev)                                          | Tests                                          | MIT        |
| [ESLint](https://eslint.org) y [Prettier](https://prettier.io)        | Lint y formato                                 | MIT        |

Cada componente conserva su propia licencia; la de Silo Browser se aplica solo al código de este repositorio. La lista completa con versiones exactas está en [package-lock.json](package-lock.json).
