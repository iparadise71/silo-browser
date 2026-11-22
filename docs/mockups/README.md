# Mockups: Fase 1 (v4)

> **Nota (9 nov 2026):** la app implementada se llama **Silo Browser** y cambió la identidad: ícono Monograma S y paleta Glaciar (azul noche con acento cian). Este mockup conserva la paleta terracota de la v4 como referencia de estructura.

Mockup interactivo de Silo en un solo archivo. Abre sin servidor; las fuentes Manrope e IBM Plex Mono vienen de Google Fonts y, sin conexión, se usa la fuente del sistema.

```bash
open docs/mockups/index.html
```

La barra de arriba es del mockup, no de la app. Cambia el escenario (con perfiles, primer uso, sin Chrome), el sistema (macOS o Windows) y el tema (oscuro o claro). Los enlaces «Ir a» abren cada pantalla directamente.

## Dirección visual

La estructura viene de lo que funciona en MultiZen (ver el [benchmark](../benchmark-multizen.md)): tarjetas con la información ordenada, filtros con contador, buscador `⌘K` y panel de actividad. La piel es propia, para que no se confunda con él:

| | MultiZen | Silo v4 |
|---|---|---|
| Base | Negro azulado | Grafito cálido (claro: papel) |
| Acento | Degradado morado → rosa con resplandor | Terracota sólido, sin degradado ni brillo |
| Efectos | Halos, sombras de color, botón que brilla | Sin resplandor; solo sombras suaves para separar capas |
| Avatar | Cuadrado redondeado | Círculo |
| Color del perfil | Solo en el ícono | Franja lateral en la tarjeta, aro del avatar e ícono del botón «Abrir» |
| Filtros | Chips con fondo | Pestañas subrayadas con contador |
| Paleta de perfiles | Saturada | Tonos tierra: petróleo, azul, lavanda, rosa, arcilla, mostaza, salvia, piedra |
| Tipografía | Sans geométrica y mono | Manrope e IBM Plex Mono |

El botón «Abrir» es neutro en todas las tarjetas y se vuelve terracota solo en la seleccionada.

## Pantallas

| Pantalla | Historia | Qué muestra |
|---|---|---|
| Biblioteca | H4 | Barra lateral con grupos. Chips Todos / Abiertos / Cerrados / Sin sesión. Tarjetas con cuenta de Google, página de inicio, última apertura y notas. Vista de lista opcional. |
| Primer uso | H4 | Portada con los tres pasos y «Crear primer perfil». |
| Crear / editar | H3, H6 | Vista previa en vivo de la tarjeta a la izquierda y formulario a la derecha: nombre, grupo, color, ícono, «Abrir en» y notas. |
| Eliminar | H6 | Conservar o borrar la carpeta de Chrome. Bloqueado si el perfil está abierto. |
| Menú | H5, H6 | Clic derecho o «⋯»: abrir o nueva ventana, cerrar Chrome, editar, duplicar sin sesión, mostrar carpeta, mover a grupo, eliminar. |
| Selección múltiple | nueva | `⌘`/`Ctrl`+clic o `⇧`+clic. Barra flotante con «Abrir N» y «Mover a grupo». También se puede arrastrar a un grupo. |
| Actividad | nueva | Panel inferior plegable con aperturas, cierres y sesiones detectadas. |
| Ajustes | H7, H8 | Navegadores detectados, ejecutable personalizado, carpeta de datos y actualizaciones. |
| Sin Chrome | H7 | Aviso sobre la biblioteca y botones «Abrir» desactivados. |

## Teclado

`⌘K` / `Ctrl K` o `/` buscar, `N` nuevo, flechas para moverse por la grilla, `Enter` abrir, `E` editar, `⌫` eliminar, `,` ajustes, `⌘A` seleccionar todo, `Esc` cerrar o quitar la selección. En la app real, `N` pasa a ser `⌘N` / `Ctrl+N`.

## Fuera del epic

La cuenta de Google en la tarjeta, «Cerrar Chrome», los grupos, la selección múltiple, el panel de actividad y «Abrir en» no están en H1–H8. El [benchmark](../benchmark-multizen.md#para-validar-antes-de-construir) explica cómo funcionarían y su riesgo.

Los datos y los tiempos son ficticios. «Abrir» simula 0,9 s de arranque.
