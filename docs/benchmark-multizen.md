# Benchmark: MultiZen

8 nov 2026. Revisión de MultiZen como referencia para la interfaz de Silo. Fuentes: el [README](https://github.com/multizenteam/multizen-browser) y las [releases](https://github.com/multizenteam/multizen-browser/releases) del repositorio, y sus dos capturas oficiales: la [biblioteca de perfiles](https://github.com/multizenteam/multizen-browser/raw/master/.github/assets/profiles-list.jpg) y el [primer arranque](https://github.com/multizenteam/multizen-browser/raw/master/.github/assets/firstrun.jpg). No se instaló la app; todo lo que sigue sale de esas fuentes.

## Qué es MultiZen hoy

El nombre lo comparten dos productos.

| | 2023 (v0.1.1) | 2026 (v0.2.9 → v0.4.2) |
|---|---|---|
| Producto | Navegador multisesión: pestañas con cookies separadas dentro de la app | «Browser library for AI agents and human operators» |
| Motor | Electron, Vue | Electron 33, React 19, Tailwind v4, SQLite. Lanza CloakBrowser (Chromium parcheado) o Camoufox (Firefox) |
| Aislamiento | Sesión por pestaña, user-agent aleatorio | Perfil completo con cookies, **huella digital falsificada**, proxy por perfil y zona horaria alineada al proxy |
| Control | Manual | Manual o por MCP (Cursor, Claude Desktop) |
| Estado | Abandonado | Activo. Última versión v0.4.2, 16 oct 2026. MIT. App de Mac sin firmar (`xattr -cr`) |

El epic de Silo cita a MultiZen por la intención de la versión de 2023 (varias cuentas sin mezclar cookies). La versión actual es un antidetect con agentes, que es justo lo que el epic deja **fuera de alcance**: huella digital, proxies y automatización. Por eso esta revisión toma de MultiZen ideas de **interfaz**, no de funciones.

## Su interfaz

Revisé las dos capturas.

**Biblioteca de perfiles.** Tema oscuro con morado neón. Arriba: logo, buscador `⌘K` («profiles, tags, urls»), contador «1 running · 6 total», indicador `MCP :7777` y ajustes. A la izquierda, una barra de íconos sin texto (perfiles, extensiones, ajustes). En el centro, «All profiles» con filtros como chips: All, Running, AI-driven, Errors, Idle, y etiquetas (`axiom`, `trading`). Grilla de tarjetas grandes con bandera o emoji, nombre, **UUID corto**, etiqueta, fila de proxy (país o «Direct — no proxy · host DNS»), sistema operativo con fecha, un botón **Launch/Stop** a todo lo ancho y `⋯`. Abajo, un panel «MCP activity».

**Primer arranque.** Pantalla de marketing: cubo 3D, «A library of isolated browsers.», lista de plataformas y un botón «Continue» con paginación. No enseña nada de la tarea.

## Qué hace bien, y lo adoptamos

**Lo visual.** De MultiZen se toma la estructura: tarjetas ordenadas, metadatos en monoespaciada, filtros con contador, botón principal con atajo visible y panel de actividad abajo. La piel es distinta a propósito, para no parecer una copia: grafito cálido con acento terracota sólido, sin degradados ni resplandores, avatares circulares, una franja con el color del perfil en cada tarjeta y pestañas subrayadas en lugar de chips. El detalle está en el [README de los mockups](mockups/README.md#dirección-visual).


| Patrón de MultiZen | Cómo queda en Silo |
|---|---|
| Contador de perfiles corriendo y totales siempre visibles | Barra superior: «1 abierto · 7 perfiles» y una píldora con el navegador detectado |
| Panel de actividad MCP abajo | Panel «Actividad» con aperturas, cierres y sesiones detectadas |
| Tarjeta resaltada mientras corre | Borde verde salvia y etiqueta «abierto», sin resplandor |
| Filtros de estado con contador (Running, Idle) | Chips: Todos, Abiertos, Cerrados, **Sin sesión**, cada uno con su contador |
| Etiquetas para agrupar perfiles | **Grupos** en la barra lateral (Clientes, Agencia…), con color, «Mover a» y arrastrar y soltar |
| Buscador con `⌘K` que busca más que el nombre | Busca en nombre, **cuenta de Google**, grupo y notas. `/` lo enfoca y `Enter` abre el primero |
| Vista grilla y lista | Igual; tarjetas por defecto |
| Stop desde la app | «Cerrar Chrome» en el menú del perfil (ver *Para validar*) |
| Página de inicio por perfil (v0.2.11) | Campo «Abrir en»: Nueva pestaña, Gmail, Drive, Calendar u otra URL. Se pasa a Chrome como argumento |
| Atajo visible en el botón principal (`⌘N`) | Atajos en tooltips, menús y pie del diálogo |

## Qué hace mal, y lo evitamos

| Problema en MultiZen | Decisión en Silo |
|---|---|
| Cada tarjeta muestra un UUID (`a7181c63-ffd`) que al usuario no le dice nada | No se muestra el id. Solo aparece en la ruta de la carpeta, dentro de Editar |
| La tarjeta no dice **qué cuenta** tiene la sesión. Se ve el país del proxy, no el correo | Debajo del nombre va la cuenta de Google, o «Sin sesión de Google» resaltado |
| Todos los botones Launch son iguales (morado) | Cada tarjeta lleva el color del perfil en su franja lateral y en el ícono de «Abrir»; solo la seleccionada usa el acento |
| Barra lateral de íconos sin texto | Barra lateral con texto, grupos y contadores |
| Fila de proxy y «host DNS» ocupando el centro de la tarjeta | Ese espacio lo ocupa la cuenta de Google con su estado de sesión |
| Información irrelevante para el caso: «macOS» en todos los perfiles, «host DNS» | Solo lo que sirve para elegir: cuenta, grupo, estado y última apertura |
| Primer arranque de marketing con «Continue» | Estado vacío que enseña los tres pasos y lleva directo a «Crear primer perfil» |
| Solo tema oscuro | Oscuro por defecto, con versión clara |
| App de Mac sin firmar (requiere `xattr -cr`) | H8 ya exige firma y notarización |

## Lo que Silo agrega y MultiZen no muestra

- **Cuenta de Google visible.** Después del primer login, Silo lee el correo de la sesión desde la carpeta del perfil y lo muestra en la lista.
- **Filtro «Sin sesión».** Encuentra los perfiles que nunca terminaron el login.
- **Selección múltiple.** `⌘`/`Ctrl`+clic o `⇧`+clic, y una barra con «Abrir N» y «Mover a grupo». Ejemplo: abrir todos los clientes de una vez.
- **Duplicar sin sesión.** Copia nombre, color, grupo y página de inicio, pero no las cookies. Así lo dice la etiqueta.
- **Eliminar con decisión explícita** sobre la carpeta de Chrome, y bloqueado mientras el perfil está abierto.

## Para validar antes de construir

Estas tres funciones del mockup **no están en el epic**. Hay que aprobarlas y estimarlas como historias nuevas, o quitarlas.

| Función | Cómo funcionaría | Riesgo |
|---|---|---|
| Cuenta de Google en la lista | Leer `Local State` → `profile.info_cache.Default.user_name` dentro de `<userData>/profiles/<id>/` cuando Chrome se cierra o en cada arranque de Silo | Es un formato interno de Chrome y puede cambiar sin aviso. Si falla, se muestra «Sin datos» y no se rompe nada |
| Cerrar Chrome desde Silo | Leer el PID del `SingletonLock` del perfil (`<host>-<pid>`) y mandar una señal de cierre normal | En Windows el lock no trae el PID; hace falta otra vía. Cerrar a la fuerza puede perder pestañas |
| Grupos | Un campo `group` en `Profile` (Zod) y una lista de grupos en el store. Sube `schemaVersion` | Bajo. Es solo datos de Silo |

«Abrir en» (página de inicio) también es nuevo en la Fase 1, pero es barato: una URL al final de los argumentos de `spawn`. El epic ya lo pide para la Fase 2 (H10).

## Lo que no se copia

Proxy, huella digital, motores antidetect, MCP, indicador «AI-driven» y telemetría. El epic los deja fuera y el análisis lo confirma. Silo es un lanzador de Chrome real, sin anti-detección.
