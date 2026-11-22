# Stack y funcionamiento

Resumen operativo de Silo Browser. El detalle de historias está en el [epic](epic.md). Los ajustes de diseño están en el [análisis](analisis.md).

## Stack

| Capa | Tecnología |
|---|---|
| App | Electron + TypeScript |
| Build y recarga | electron-vite |
| Interfaz | React + Tailwind |
| Datos de la app | JSON en el disco, validado con Zod |
| Empaquetado | electron-builder (`.dmg` y `.exe`) |
| Calidad | ESLint, Prettier, Vitest |

El proceso main (Node) guarda perfiles y lanza Chrome. El preload expone una API corta (`profiles.list`, `profiles.create`, `profiles.open`). La ventana de React solo dibuja la interfaz.

## Cómo funciona

1. Creas un perfil con nombre, color e ícono.
2. La app le asigna un id y crea la carpeta `<userData>/profiles/<id>/`.
3. La lista muestra esas tarjetas. El buscador filtra en local.
4. Al cerrar Silo Browser, la lista y las carpetas siguen en el disco y los perfiles abiertos se cierran (con confirmación).

## Cómo abre Chrome aislado

«Abrir» ejecuta el Chrome instalado en la máquina, en un proceso aparte:

```text
Google Chrome --user-data-dir="<userData>/profiles/<id>" --no-first-run --no-default-browser-check
```

Esa carpeta es el perfil completo: cookies, sesión de Google, historial y extensiones. Otro perfil apunta a otra carpeta, así que no comparten nada.

El proceso va `detached` y con `unref`. Al salir de Silo Browser, la app cierra esos Chrome: les envía SIGTERM (Chrome guarda la sesión) usando el PID del `SingletonLock` y fuerza con SIGKILL los que no terminen en 6 s.

En Mac se lanza el binario `Google Chrome.app/Contents/MacOS/Google Chrome`. El comando `open -a` reutiliza el perfil por defecto del sistema y no sirve para aislar.

Si ese perfil ya está abierto, Chrome reutiliza el mismo proceso. Silo lo detecta con el `SingletonLock` de la carpeta y no lanza una segunda copia.

Flags que no se usan: remote debugging y `--enable-automation`. El login de Google es manual, dentro de Chrome real.
