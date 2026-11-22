#!/bin/sh
# Electron necesita chrome-sandbox con SUID root en Ubuntu 24.04+ (AppArmor restringe user namespaces).
SANDBOX="/opt/Silo Browser/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX"
  chmod 4755 "$SANDBOX"
fi
# Recarga la caché de íconos y accesos.
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q || true
