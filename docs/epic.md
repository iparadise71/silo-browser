# Epic: Gestor de perfiles aislados de Chrome

8 nov 2026

Producto: **silo-browser**. Similar en intención a un navegador multi-cuenta tipo Multizen, con el lanzador de Chrome real primero y las pestañas embebidas después.

## Resumen

Construir una app de escritorio (Mac y Windows) que gestione varios perfiles de Chrome totalmente aislados, cada uno con su propia cuenta de Google y sus propias sesiones, y los abra con un clic.

**Problema.** Usar varias cuentas de Google o de una misma app web en un solo navegador obliga a cambiar de cuenta, usar ventanas de incógnito o mezclar cookies. Los perfiles nativos de Chrome sirven, pero son incómodos de crear, nombrar y abrir en volumen.

## Alcance

- **Fase 1 (MVP):** lanzador de Chrome real, con un `--user-data-dir` distinto por perfil. Incluye crear, listar, editar, eliminar y abrir perfiles, y empaquetar la app.
- **Fase 2:** abrir perfiles como pestañas aisladas dentro de la propia app (`WebContentsView` + `partition`).

## Fuera de alcance

- Falsificar la huella digital del navegador, rotar proxies o evadir la detección de las plataformas.
- Automatizar acciones dentro de las cuentas (bots, Puppeteer o Playwright).
- Versión móvil.

## Criterios de éxito

- Crear un perfil nuevo y tenerlo abierto con sesión de Google iniciada en menos de 1 minuto.
- Dos perfiles abiertos a la vez no comparten cookies, sesiones ni extensiones.
- Los perfiles y sus sesiones siguen ahí después de reiniciar la app y la computadora.
- La app se instala desde un `.dmg` (Mac) y un `.exe` (Windows).

## Stack y decisiones técnicas

Se usa Electron porque todo se escribe en TypeScript y cubre las dos fases sin cambiar de tecnología.

| Capa | Elección | Motivo |
|---|---|---|
| Base | Electron + TypeScript | Node.js para procesos y archivos, y Chromium para la Fase 2 |
| Scaffolding y build | electron-vite | Recarga en caliente de main, preload y renderer con Vite |
| UI | React + Tailwind | Ecosistema conocido, componentes simples |
| Persistencia | electron-store (JSON con schema) | Suficiente para una lista de perfiles; sin base de datos |
| Empaquetado | electron-builder | `.dmg` y `.exe`, firma, notarización y auto-update |
| Calidad | ESLint, Prettier, Vitest | Lint y tests unitarios de la lógica del proceso main |

El análisis técnico ajusta la persistencia: ver [análisis](analisis.md). El resumen operativo está en [stack y funcionamiento](stack-y-funcionamiento.md).

## Arquitectura

- **Main (Node):** guarda los perfiles, crea las carpetas de datos, detecta dónde está Chrome y lo lanza con `child_process.spawn`.
- **Preload:** expone una API mínima y tipada con `contextBridge` (`profiles.list`, `profiles.create`, `profiles.open`…).
- **Renderer (React):** solo interfaz. Sin acceso a Node (`contextIsolation: true`, `nodeIntegration: false`).

## Por qué no otras opciones

- **Tauri:** más liviano, pero el backend es en Rust y en Mac usa WebKit, así que limita la Fase 2.
- **Puppeteer o Playwright:** Google detecta la automatización y bloquea el login.

## Fase 1: MVP lanzador

Ocho historias, 34 puntos en total. Las estimaciones están en puntos de historia (Fibonacci) y son una primera propuesta para refinar con el equipo.

| ID | Historia | Puntos | Depende de |
|---|---|---:|---|
| H1 | Configuración del proyecto | 3 | — |
| H2 | Persistencia de perfiles | 3 | H1 |
| H3 | Crear un perfil | 3 | H2 |
| H4 | Ver la lista de perfiles | 3 | H2 |
| H5 | Abrir un perfil en Chrome aislado | 8 | H2 |
| H6 | Editar y eliminar perfiles | 3 | H4 |
| H7 | Chrome no encontrado o ruta personalizada | 3 | H5 |
| H8 | Empaquetado y distribución | 8 | H5 |

### H1 · Configuración del proyecto (técnica)

Como desarrollador, quiero una base de proyecto lista para que el equipo empiece a construir funciones sin discutir la estructura.

**Criterios de aceptación**

- `npm run dev` abre la app con recarga en caliente en Mac y Windows.
- El renderer no tiene acceso a Node; toda comunicación pasa por el preload.
- Lint y tests corren en CI en cada pull request.

**Tareas**

- [ ] Crear el proyecto con `npm create @quick-start/electron` (plantilla `react-ts`).
- [ ] Configurar ESLint, Prettier y Vitest.
- [ ] Definir la estructura `src/main`, `src/preload`, `src/renderer` y `src/shared` (tipos compartidos).
- [ ] Crear un helper de IPC tipado (canal, request y response definidos en shared).
- [ ] Activar `contextIsolation`, `sandbox` y una Content Security Policy en el renderer.
- [ ] Configurar GitHub Actions: lint, tests y build en macOS y Windows.

### H2 · Persistencia de perfiles (técnica)

Como usuario, quiero que mis perfiles sigan ahí al cerrar y volver a abrir la app.

**Criterios de aceptación**

- Cada perfil guarda: id (UUID), nombre, color, ícono o emoji, notas, ruta de datos, fecha de creación y última apertura.
- Los datos de Chrome de cada perfil viven en `<userData>/profiles/<id>/`.
- Un archivo corrupto no rompe la app: se respalda y se arranca con una lista vacía.

**Tareas**

- [ ] Definir el tipo `Profile` y su schema de validación (Zod).
- [ ] Implementar `ProfileRepository` sobre electron-store (`list`, `get`, `create`, `update`, `remove`).
- [ ] Crear y borrar la carpeta de datos de cada perfil.
- [ ] Agregar un campo `schemaVersion` y una función de migración.
- [ ] Exponer los canales IPC `profiles:*` y su API en el preload.
- [ ] Tests unitarios del repositorio.

### H3 · Crear un perfil

Como usuario, quiero crear un perfil con nombre, color e ícono para identificar cada cuenta de un vistazo.

**Criterios de aceptación**

- El formulario pide nombre (obligatorio, único), color e ícono; las notas son opcionales.
- Al guardar, el perfil aparece en la lista sin recargar la app.
- Hay un botón «Crear y abrir» que lo lanza de inmediato.

**Tareas**

- [ ] Diseñar el modal de creación (nombre, selector de color, selector de emoji, notas).
- [ ] Validar nombre vacío y duplicado.
- [ ] Conectar con `profiles.create` y actualizar el estado global.
- [ ] Implementar la acción «Crear y abrir».

### H4 · Ver la lista de perfiles

Como usuario, quiero ver todos mis perfiles y encontrar uno rápido.

**Criterios de aceptación**

- Cada perfil se muestra como tarjeta con color, ícono, nombre, notas y estado (abierto o cerrado).
- Un buscador filtra por nombre y notas mientras se escribe.
- Sin perfiles, se muestra un estado vacío con el botón «Crear perfil».

**Tareas**

- [ ] Componente de tarjeta de perfil.
- [ ] Grilla o lista con ordenamiento por nombre o por última apertura.
- [ ] Buscador con filtro local.
- [ ] Estado vacío.
- [ ] Indicador de perfil abierto, alimentado por eventos del proceso main.

### H5 · Abrir un perfil en Chrome aislado

Como usuario, quiero abrir un perfil con un clic y tener un Chrome con solo las sesiones de esa cuenta.

**Criterios de aceptación**

- «Abrir» lanza Chrome con `--user-data-dir` apuntando a la carpeta del perfil.
- Dos perfiles abiertos a la vez no comparten cookies, sesiones ni extensiones.
- Abrir un perfil que ya está abierto enfoca su ventana en lugar de crear otra instancia.
- El login de Google funciona y la sesión se mantiene al cerrar y volver a abrir.
- ~~Cerrar la app no cierra los Chrome abiertos.~~ **Cambio (9 nov 2026):** al cerrar la app se cierran todos los perfiles abiertos, con confirmación previa. Chrome recibe SIGTERM y guarda la sesión de cada perfil.

**Tareas**

- [ ] Detectar la ruta de Chrome en Mac (`/Applications/Google Chrome.app/...`) y Windows (Program Files y LocalAppData).
- [ ] Implementar `ChromeLauncher.open(profile)` con `spawn` (`detached: true`, `--no-first-run`, `--no-default-browser-check`).
- [ ] Registrar el PID por perfil y escuchar `exit` para actualizar el estado.
- [ ] Manejar el caso «perfil ya abierto» (Chrome reutiliza la instancia del mismo `user-data-dir`).
- [ ] Actualizar la fecha de última apertura.
- [ ] Probar a mano: login de Google en 3 perfiles a la vez, en Mac y Windows.

El criterio de «enfocar la ventana» y el seguimiento por PID se ajustan en el [análisis](analisis.md).

### H6 · Editar y eliminar perfiles

Como usuario, quiero cambiar el nombre o color de un perfil y borrar los que ya no uso.

**Criterios de aceptación**

- Se pueden editar nombre, color, ícono y notas.
- Eliminar pide confirmación y ofrece borrar también los datos (cookies, historial) o conservarlos.
- No se puede eliminar un perfil que está abierto.

**Tareas**

- [ ] Reutilizar el modal de H3 en modo edición.
- [ ] Diálogo de confirmación con la opción «borrar datos».
- [ ] Bloquear la eliminación si el perfil está abierto.
- [ ] Acción «Duplicar perfil» (copia solo la configuración, no la sesión).

### H7 · Chrome no encontrado o ruta personalizada

Como usuario sin Chrome en la ruta estándar, quiero indicarle a la app dónde está el navegador.

**Criterios de aceptación**

- Si no se encuentra Chrome, la app lo dice y ofrece descargarlo o elegir el ejecutable.
- En Ajustes se puede elegir otro navegador basado en Chromium (Chromium, Brave, Edge).

**Tareas**

- [ ] Pantalla de Ajustes con la ruta del navegador.
- [ ] Selector de archivo nativo (`dialog.showOpenDialog`) y validación del ejecutable.
- [ ] Mensaje y enlace de descarga cuando Chrome falta.

### H8 · Empaquetado y distribución

Como usuario, quiero instalar la app como cualquier otra, sin advertencias de seguridad.

**Criterios de aceptación**

- CI genera un `.dmg` (Apple Silicon e Intel) y un instalador `.exe`.
- La app de Mac está firmada y notarizada; Gatekeeper no la bloquea.
- La app avisa cuando hay una versión nueva y se actualiza.

**Tareas**

- [ ] Configurar electron-builder (ícono, nombre, `appId`, targets).
- [ ] Firma y notarización en Mac (cuenta Apple Developer).
- [ ] Firma de código en Windows (certificado), o documentar el aviso de SmartScreen si no hay certificado.
- [ ] Auto-update con electron-updater y GitHub Releases.
- [ ] Workflow de release que publique los binarios al crear un tag.

## Fase 2: pestañas aisladas dentro de la app

La Fase 2 empieza con un spike de 3 días sobre el login de Google. Si Google bloquea el login embebido, se replantea la fase antes de construir el resto.

| ID | Historia | Puntos | Depende de |
|---|---|---:|---|
| H9 | Spike: login de Google en vistas embebidas | 3 | Fase 1 |
| H10 | Abrir un perfil como pestaña | 8 | H9 |
| H11 | Navegación básica en la pestaña | 5 | H10 |
| H12 | Notificaciones y contador por perfil | 5 | H10 |

### H9 · Spike: login de Google en vistas embebidas (técnica)

Como equipo, queremos saber si Google permite iniciar sesión dentro de la app antes de invertir en la Fase 2.

**Criterios de aceptación**

- Hay un informe corto con el resultado del login en Gmail, Drive y YouTube, en Mac y Windows.
- Si funciona, documenta la configuración exacta (user-agent, flags). Si no, propone alternativas.

**Tareas**

- [ ] Prototipo con `WebContentsView` y `partition: 'persist:test'`.
- [ ] Probar el login con el user-agent por defecto y con uno de Chrome sin el token «Electron».
- [ ] Probar con una cuenta con verificación en dos pasos.
- [ ] Escribir el informe y la recomendación (seguir, pivotar o cancelar la fase).

Quitar el token `Electron` del user-agent en este spike es compatibilidad de login. No es un suite de anti-detección. La huella digital sigue fuera de alcance.

### H10 · Abrir un perfil como pestaña

Como usuario, quiero tener mis cuentas como pestañas en una barra lateral, sin abrir ventanas de Chrome aparte.

**Criterios de aceptación**

- Cada perfil tiene un modo de apertura: «Chrome externo» o «Pestaña».
- Cada pestaña usa su propia `partition` persistente; las sesiones no se mezclan.
- Al cambiar de pestaña, las demás siguen cargadas y conservan su estado.
- Las sesiones se mantienen al reiniciar la app.

**Tareas**

- [ ] Barra lateral con los perfiles en modo pestaña.
- [ ] `TabManager` en el proceso main: crear, mostrar, ocultar y destruir `WebContentsView` por perfil.
- [ ] URL inicial configurable por perfil (por ejemplo, Gmail).
- [ ] Ajustar el tamaño de la vista al redimensionar la ventana.
- [ ] Opción de suspender pestañas inactivas para ahorrar memoria.

El modo de apertura elige el almacén de la sesión. El `user-data-dir` de Chrome y la `partition` de Electron no comparten cookies. Cambiar de modo pide el login otra vez. Ver [análisis](analisis.md).

### H11 · Navegación básica en la pestaña

Como usuario, quiero moverme dentro de la pestaña como en un navegador.

**Criterios de aceptación**

- Hay botones de atrás, adelante y recargar, y se muestra la URL actual.
- Los enlaces que abren ventanas nuevas se abren en el navegador del sistema o en una nueva pestaña del mismo perfil (configurable).
- Las descargas van a la carpeta de Descargas y muestran progreso.

**Tareas**

- [ ] Barra de navegación conectada al `webContents` activo.
- [ ] Manejar `setWindowOpenHandler`.
- [ ] Manejar el evento `will-download` con progreso.
- [ ] Atajos de teclado (Cmd/Ctrl+R, Cmd/Ctrl+1..9 para cambiar de pestaña).

### H12 · Notificaciones y contador por perfil

Como usuario, quiero saber qué cuenta tiene mensajes nuevos sin entrar a cada una.

**Criterios de aceptación**

- Las notificaciones web se muestran como notificaciones del sistema con el nombre del perfil.
- El ícono del perfil en la barra lateral muestra un contador cuando el título de la página lo trae (por ejemplo, «Recibidos (3)»).
- Se pueden silenciar las notificaciones de un perfil.

**Tareas**

- [ ] Manejar permisos de notificación por session (`setPermissionRequestHandler`).
- [ ] Leer el contador desde `page-title-updated`.
- [ ] Badge en la barra lateral y en el ícono del dock.
- [ ] Opción «Silenciar» por perfil.

## Riesgos, dependencias y definición de terminado

El riesgo principal es que Google bloquee el login dentro de la app (Fase 2). La Fase 1 no lo tiene porque usa Chrome real.

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Google bloquea el login en vistas embebidas | Alto, Fase 2 | Spike H9 antes de construir; el modo «Chrome externo» sigue disponible |
| Cambios de Chrome en flags o rutas de instalación | Medio | Ruta configurable (H7); probar con cada versión estable |
| Avisos de seguridad al instalar sin firma | Medio | Cuenta Apple Developer y certificado de Windows (H8) |
| Consumo de memoria con muchos perfiles abiertos | Medio | Suspender pestañas inactivas (H10) |
| Datos de sesión sin cifrar en disco | Medio | Documentarlo; Chrome ya cifra las cookies con el llavero del sistema |

### Dependencias

- Cuenta de Apple Developer (USD 99 al año) para firmar y notarizar en Mac.
- Certificado de firma de código para Windows (opcional en el MVP).
- Equipos de prueba con Mac y Windows.

### Definición de terminado (por historia)

- Cumple todos sus criterios de aceptación en Mac y Windows.
- Código revisado en un pull request, con lint y tests en verde.
- La lógica del proceso main tiene tests unitarios.
- Sin errores en la consola del renderer ni del proceso main.
- Probado a mano en un build empaquetado, no solo en modo dev.

### Definición de terminado (epic, Fase 1)

- Las historias H1 a H8 están terminadas.
- Hay un release publicado con `.dmg` y `.exe` descargables.
- Se cumplen los criterios de éxito del resumen.
