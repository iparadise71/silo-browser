# Silo Browser

App de escritorio (Mac y Windows) que gestiona varios perfiles de Chrome totalmente aislados. Cada perfil tiene su propia cuenta de Google y sus propias sesiones, y se abre con un clic.

El directorio del repositorio es `soli-browser`. El nombre de producto es **silo-browser**. El `appId` previsto es `com.idealdevs.silobrowser`.

## Documentos

El código y cómo ejecutarlo están en el [README del proyecto](../README.md).

| Documento | Contenido |
|---|---|
| [Epic](epic.md) | Alcance, historias H1–H12, criterios de aceptación y definición de terminado. 8 nov 2026. |
| [Análisis](analisis.md) | Lectura técnica del epic: qué se sostiene, huecos a cerrar antes de codear y orden de construcción. |
| [Stack y funcionamiento](stack-y-funcionamiento.md) | Tecnologías y cómo se abre un Chrome aislado. |
| [Benchmark: MultiZen](benchmark-multizen.md) | Qué se toma y qué no de la interfaz de MultiZen, y funciones nuevas a validar. |
| [Mockups](mockups/README.md) | Mockup interactivo de la Fase 1 (v4): biblioteca con grupos, primer uso, crear, editar, eliminar, selección múltiple, ajustes y Chrome no encontrado. |

## Fases

- **Fase 1 (MVP):** lanzador de Chrome real, con un `--user-data-dir` distinto por perfil. Historias H1–H8, 34 puntos.
- **Fase 2:** perfiles como pestañas aisladas dentro de la app. Empieza solo después del spike H9. Historias H9–H12, 21 puntos.
