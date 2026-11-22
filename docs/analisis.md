# Análisis del epic

8 nov 2026. Lectura del [epic](epic.md) antes de escribir código. El repositorio estaba vacío en esa fecha.

## Veredicto

La Fase 1 se puede construir con el stack del epic. Electron, un `--user-data-dir` por perfil y el spike de login antes de las pestañas embebidas es el orden correcto: el login de Google ocurre en Chrome real, y la vista embebida espera a saber si Google la deja pasar.

Los 34 puntos de H1–H8 cierran un MVP instalable. El calendario depende de H5 y H8 (8 puntos cada una): el proceso de Chrome y la firma.

| Dato | Valor |
|---|---|
| Puntos Fase 1 (H1–H8) | 34 |
| Puntos Fase 2 (H9–H12) | 21 |
| Huecos que cambian el diseño | 4 |

## Qué se sostiene

Electron cubre las dos fases en TypeScript: Node lanza Chrome real en la Fase 1 y el mismo Chromium hospeda las pestañas en la Fase 2. Tauri dejaría esa segunda fase en WebKit en Mac. Puppeteer queda fuera porque el login de Google ocurre a mano, dentro de Chrome.

Un `--user-data-dir` distinto por perfil separa cookies, sesiones y extensiones, y esa carpeta sobrevive al cierre de la app y al reinicio de la máquina.

Frente a un navegador tipo Multizen, el orden del epic también es el correcto. Esos productos suelen empezar por la vista embebida. Aquí el lanzador con Chrome real sale primero, y el login embebido espera al spike H9.

## Ajustes antes de codear

Si estas historias se implementan al pie de la letra, el comportamiento de abajo falla.

### 1. El estado «abierto» no sale del PID (H4, H5)

Chrome con el mismo `user-data-dir` ya en marcha recibe el segundo lanzamiento y el proceso nuevo termina enseguida. Escuchar `exit` marca el perfil como cerrado mientras la ventana sigue ahí. Al reiniciar Silo, los PID en memoria desaparecen y todas las tarjetas quedarían en cerrado.

**Ajuste.** Rehidratar «abierto» leyendo el `SingletonLock` de la carpeta del perfil.

### 2. El segundo clic no enfoca la ventana desde la app (H5)

Chrome no ofrece una API para enfocar la ventana de un `user-data-dir`.

**Ajuste.** El criterio pasa a ser: no nace otro proceso de navegador para ese perfil. El singleton de Chrome recibe el lanzamiento.

### 3. `electron-store` no cumple solo el archivo corrupto (H2)

`electron-store` no respalda un JSON inválido y ata los tests al proceso de Electron.

**Ajuste.** Storage inyectable. Zod valida al leer. Si el archivo no parsea, se renombra a `.bak` y la lista arranca vacía. `schemaVersion` empieza en 1.

### 4. Chrome externo y pestaña embebida no comparten el login (H10)

El `user-data-dir` de Chrome y la `partition` de Electron guardan cookies distintas.

**Ajuste.** El modo de apertura elige el almacén de la sesión. Pasar de «Chrome externo» a «Pestaña» pide el login de Google otra vez. Hay que decirlo en el producto.

### Otros ajustes

| Historia | Ajuste |
|---|---|
| H5 | Sembrar `profile.name` en `Preferences` antes del primer arranque, para que Chrome muestre el nombre y las ventanas no se vean iguales en el Dock y en la barra de tareas. El color y el emoji viven en Silo. |
| H1 | CSP estricta solo en el build. Vite en dev necesita recarga en caliente. `contextIsolation`, `sandbox` y `nodeIntegration: false` van desde el inicio. |
| H1, H8 | Cada PR corre lint, tests y `electron-vite build` en macOS y Windows. El `.dmg`, el `.exe`, la firma y la notarización salen al crear el tag. |
| H8 | En Windows, sin certificado, se documenta el aviso de SmartScreen. La historia de usuario pide instalar sin advertencias; el certificado de Windows es opcional en el MVP. |

## Orden de construcción

| Paso | Historias | Entrega |
|---:|---|---|
| 1 | H1 | electron-vite `react-ts`, Tailwind, IPC tipado con request y eventos, `appId`, ESLint, Prettier, Vitest |
| 2 | H2 | `Profile` con Zod, carpetas en `userData/profiles/<id>`, `schemaVersion` 1, canales `profiles:*` |
| 3 | H5 junto con H3 y H4 | El lanzador es el riesgo. La grilla, el buscador y el modal solo consumen la API y el evento de estado |
| 4 | H6 y H7 | Editar, duplicar configuración, borrar con o sin datos, y ruta de Chrome, Brave o Edge |
| 5 | H8 | electron-builder, firma, notarización y electron-updater cuando exista el tag |

H9 no empieza hasta que H1–H8 están en un build empaquetado. Si Google bloquea el login embebido, el modo Chrome externo sigue siendo el producto.

## Decisiones fijas

| Tema | Valor |
|---|---|
| Nombre de producto | `silo-browser`. La carpeta del repo es `soli-browser`. `package.json` y el `appId` salen del nombre de producto. |
| appId | `com.idealdevs.silobrowser` |
| Interfaz | React, Tailwind y estado en contexto. Sin Redux. |
| Idioma de la UI | Español, como los textos del epic. |
| Lanzamiento | `spawn` del binario, `detached`, `unref`, `stdio: 'ignore'`. Argumentos en array, sin shell. |
| Mac | `Google Chrome.app/Contents/MacOS/Google Chrome`. El comando `open -a` reutiliza el perfil por defecto del sistema. |
| Windows | Program Files, LocalAppData y la clave `App Paths\chrome.exe` del registro. |
| Flags | `--user-data-dir`, `--no-first-run`, `--no-default-browser-check`. Sin remote debugging ni `--enable-automation`. |
| Cerrar Silo | **Cambio (9 nov 2026):** al salir se cierran todos los perfiles abiertos, previa confirmación. SIGTERM al PID del `SingletonLock` (Chrome guarda la sesión) y SIGKILL si no termina en 6 s. `detached` + `unref` siguen: Chrome no depende del proceso de la app. |
| Tests | Vitest sobre módulos puros del main, con un store falso. Un ejecutable falso registra los argumentos del lanzador. |

## Fuera de este MVP

Huella digital, proxies, bots y móvil siguen fuera. Quitar el token `Electron` del user-agent en H9 es compatibilidad de login, y se documenta en el informe del spike.

La definición de terminado pide prueba manual en Mac y en Windows sobre un build empaquetado. El runner de CI compila; no sustituye el login de Google en tres perfiles a la vez.
