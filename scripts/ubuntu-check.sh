#!/usr/bin/env bash
# Verificación en Ubuntu 24.04 limpio (contenedor). Uso desde macOS o Linux:
#   tar --exclude=node_modules --exclude=out --exclude=release --exclude=.git -c . \
#     | podman run --rm -i -v "$PWD/release/ubuntu-check:/result" ubuntu:24.04 \
#       bash -c 'mkdir /app && tar -x -C /app && bash /app/scripts/ubuntu-check.sh < /dev/null'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
step() { printf '\n=== %s ===\n' "$*"; }

step "Paquetes del sistema"
APT="-o Acquire::http::Timeout=30 -o Acquire::Retries=3"
timeout --foreground 300 apt-get $APT update -qq
timeout --foreground 900 apt-get $APT install -y -qq --no-install-recommends curl ca-certificates xz-utils xvfb xauth fakeroot dpkg-dev \
  libgtk-3-0t64 libnss3 libasound2t64 libgbm1 libxss1 libxtst6 libatk-bridge2.0-0t64 \
  libdrm2 libxkbcommon0 libcups2t64 libsecret-1-0 libnotify4 fonts-noto-color-emoji >/dev/null
. /etc/os-release && echo "$PRETTY_NAME ($(uname -m))"

step "Node 22"
ARCH=$(uname -m); case "$ARCH" in x86_64) NA=x64;; aarch64) NA=arm64;; esac
curl -fsSL --retry 3 --max-time 300 "https://nodejs.org/dist/v22.21.1/node-v22.21.1-linux-$NA.tar.xz" | tar -xJ -C /usr/local --strip-components=1
node -v && npm -v

cd /app
step "npm ci";        npm ci --no-audit --no-fund 2>&1 | tail -2
step "lint";          npm run -s lint
step "typecheck";     npm run -s typecheck
step "tests";         npm test 2>&1 | tail -6
step "build";         npm run -s build >/dev/null && ls out
step "smoke (Xvfb)";  xvfb-run -a npm run -s smoke -- --fake-browser --out /result/ubuntu-smoke.png
step "smoke abrir perfil"
xvfb-run -a npm run -s smoke -- --fake-browser --out /result/ubuntu-open.png --js \
  "const q=s=>document.querySelector(s);const qa=s=>[...document.querySelectorAll(s)];const sleep=ms=>new Promise(r=>setTimeout(r,ms));const c=qa('[data-id]').find(x=>x.querySelector('.nm').textContent==='Personal');c.querySelector('.launch').click();await sleep(900);return {toast:q('.toast span:last-child')?.textContent,pill:c.querySelector('.pill').textContent,browser:q('.chrome-pill').textContent}"
step "smoke salir cierra perfiles"
xvfb-run -a npm run -s smoke -- --quit --out /result/ubuntu-quit.png --js "const sleep=ms=>new Promise(r=>setTimeout(r,ms));const cards=[...document.querySelectorAll('[data-id]')].slice(1,4);for(const c of cards){c.querySelector('.launch').click();await sleep(400)}for(let i=0;i<30;i++){if(document.querySelectorAll('.pill.on').length>=3)break;await sleep(200)}"
step "empaquetado (AppImage + deb, $NA)"
npx electron-builder --linux AppImage deb --$NA 2>&1 | grep -E "building|target=|error|Error" || true
ls -la release/*/ | grep -E "AppImage|deb" | tee /result/packages.txt
step "deb: contenido"
dpkg-deb -I release/*/Silo-Browser-*-"$NA".deb | grep -E "Package|Version|Architecture|Depends" || dpkg-deb -I release/*/*.deb | head -20
step "OK"
