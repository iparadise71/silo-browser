"""Genera 10 propuestas de ícono (paleta Glaciar), de lo concreto a lo abstracto."""
import math

DEFS = """
<defs>
  <radialGradient id="bg" cx="30%" cy="18%" r="95%">
    <stop offset="0" stop-color="#1d3a86"/>
    <stop offset=".55" stop-color="#11245a"/>
    <stop offset="1" stop-color="#081231"/>
  </radialGradient>
  <linearGradient id="n" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3159c4"/>
    <stop offset="1" stop-color="#1f3c93"/>
  </linearGradient>
  <linearGradient id="n2" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#26489f"/>
    <stop offset="1" stop-color="#18306f"/>
  </linearGradient>
  <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7cecff"/>
    <stop offset="1" stop-color="#14b4e4"/>
  </linearGradient>
  <linearGradient id="hl" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".35"/>
    <stop offset=".35" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#020617" flood-opacity=".55"/>
  </filter>
  <clipPath id="tile"><rect x="100" y="100" width="824" height="824" rx="184"/></clipPath>
</defs>
"""
FRAME = """
<rect x="100" y="100" width="824" height="824" rx="184" fill="url(#bg)"/>
<rect x="100" y="100" width="824" height="412" rx="184" fill="url(#hl)" opacity=".18" clip-path="url(#tile)"/>
<rect x="101" y="101" width="822" height="822" rx="183" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>
"""
DOT = "#0a1430"


def svg(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">{DEFS}{FRAME}{body}</svg>'


def shine(shape):
    """Repite la forma con un brillo superior suave encima."""
    return shape.replace('fill="url(#n)"', 'fill="url(#hl)"').replace('fill="url(#a)"', 'fill="url(#hl)"').replace(
        'fill="url(#n2)"', 'fill="url(#hl)"'
    )


def piece(shape):
    return f'<g filter="url(#sh)">{shape}</g>{shine(shape)}'


def hexagon(cx, cy, r, rot=-90):
    return " ".join(
        f"{cx + r * math.cos(math.radians(60 * i + rot)):.1f},{cy + r * math.sin(math.radians(60 * i + rot)):.1f}"
        for i in range(6)
    )


P = []

# 1 · Silos: tres columnas con cúpula; la central activa
s = ""
for x, f in [(268, "n"), (442, "a"), (616, "n")]:
    s += piece(f'<rect x="{x}" y="276" width="140" height="472" rx="70" fill="url(#{f})"/>')
s += f'<circle cx="512" cy="364" r="30" fill="{DOT}"/>'
P.append(("01-silos", "Silos", "Tres columnas con cúpula; la central, activa.", s))

# 2 · Silo de granja: una silueta, con el compartimento activo en cian
s = piece(
    '<path d="M332 470 A180 180 0 0 1 692 470 V760 Q692 788 664 788 H360 Q332 788 332 760 Z" fill="url(#n)"/>'
)
s += '<rect x="332" y="540" width="360" height="104" fill="url(#a)"/><rect x="332" y="540" width="360" height="104" fill="url(#hl)"/>'
for y in (536, 644):
    s += f'<rect x="332" y="{y}" width="360" height="10" fill="{DOT}" opacity=".85"/>'
s += f'<rect x="468" y="580" width="88" height="24" rx="12" fill="{DOT}"/>'
P.append(("02-granja", "Granero", "La silueta de un silo; el compartimento del medio, activo.", s))

# 3 · Cajones: tres cajones, el activo sale hacia afuera
s = ""
s += piece('<rect x="262" y="272" width="440" height="140" rx="44" fill="url(#n)"/>')
s += piece('<rect x="322" y="442" width="440" height="140" rx="44" fill="url(#a)"/>')
s += piece('<rect x="262" y="612" width="440" height="140" rx="44" fill="url(#n)"/>')
s += f'<rect x="490" y="498" width="104" height="28" rx="14" fill="{DOT}"/>'
P.append(("03-cajones", "Cajón abierto", "Tres cajones; el activo, salido hacia afuera.", s))

# 4 · Panal: tres celdas, la activa elevada
s = ""
r = 98
dx = (math.sqrt(3) * r + 24 + 44) / 2  # ancho del hexágono + trazo + separación
dy = dx * math.sqrt(3)
for cx, cy, f in [(512, 512 - dy / 2, "a"), (512 - dx, 512 + dy / 2, "n"), (512 + dx, 512 + dy / 2, "n")]:
    s += piece(
        f'<polygon points="{hexagon(cx, cy, r)}" fill="url(#{f})" stroke-linejoin="round" stroke="url(#{f})" stroke-width="24"/>'
    )
s += f'<circle cx="512" cy="{512 - dy / 2:.1f}" r="30" fill="{DOT}"/>'
P.append(("04-panal", "Panal", "Celdas separadas; la activa, arriba.", s))

# 5 · Abanico: tres celdas en arco, como cartas desplegadas
s = ""
for ang, f in [(-16, "n2"), (16, "n2"), (0, "a")]:
    s += f'<g transform="rotate({ang} 512 860)">' + piece(
        f'<rect x="402" y="250" width="220" height="400" rx="56" fill="url(#{f})"/>'
    ) + "</g>"
s += f'<circle cx="512" cy="330" r="30" fill="{DOT}"/>'
P.append(("05-abanico", "Abanico", "Perfiles desplegados; el del frente, activo.", s))

# 6 · Ventana: un marco de navegador con un panel aislado
s = piece('<rect x="236" y="276" width="552" height="472" rx="64" fill="url(#n2)"/>')
for i, x in enumerate((284, 318, 352)):
    s += f'<circle cx="{x}" cy="326" r="11" fill="#5b7fe0" opacity="{0.9 - i * 0.2}"/>'
s += piece('<rect x="284" y="376" width="200" height="324" rx="36" fill="url(#n)"/>')
s += piece('<rect x="512" y="376" width="228" height="324" rx="36" fill="url(#a)"/>')
s += f'<circle cx="626" cy="538" r="32" fill="{DOT}"/>'
P.append(("06-ventana", "Ventana", "Un navegador dividido; un panel, el perfil abierto.", s))

# 7 · Órbita: perfiles en órbita alrededor de un núcleo
s = '<circle cx="512" cy="512" r="236" fill="none" stroke="#3159c4" stroke-opacity=".55" stroke-width="16"/>'
s += piece('<circle cx="512" cy="512" r="96" fill="url(#n)"/>')
for ang, f, rr in [(-60, "a", 74), (60, "n", 58), (180, "n", 58)]:
    x = 512 + 236 * math.cos(math.radians(ang))
    y = 512 + 236 * math.sin(math.radians(ang))
    s += piece(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr}" fill="url(#{f})"/>')
x = 512 + 236 * math.cos(math.radians(-60))
y = 512 + 236 * math.sin(math.radians(-60))
s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="24" fill="{DOT}"/>'
P.append(("07-orbita", "Órbita", "Perfiles separados que giran en torno a Silo.", s))

# 8 · Capas: tres planos aislados en perspectiva
s = ""
for dy, f in [(170, "n2"), (85, "n"), (0, "a")]:
    s += piece(
        f'<path d="M512 {250 + dy} L752 {380 + dy} Q770 {392 + dy} 752 {404 + dy} L524 {528 + dy} Q512 {534 + dy} 500 {528 + dy} L272 {404 + dy} Q254 {392 + dy} 272 {380 + dy} Z" fill="url(#{f})"/>'
    )
s += f'<ellipse cx="512" cy="392" rx="44" ry="24" fill="{DOT}"/>'
P.append(("08-capas", "Capas", "Planos apilados en perspectiva; el de arriba, activo.", s))

# 9 · Monograma S: dos bloques desplazados que forman una S
s = '<g filter="url(#sh)">'
s += '<path d="M690 322 H404 Q336 322 336 390 V408 Q336 476 404 476 H468" fill="none" stroke="url(#a)" stroke-width="108" stroke-linecap="round" stroke-linejoin="round"/>'
s += '<path d="M556 548 H620 Q688 548 688 616 V634 Q688 702 620 702 H334" fill="none" stroke="url(#n)" stroke-width="108" stroke-linecap="round" stroke-linejoin="round"/>'
s += "</g>"
s += f'<circle cx="404" cy="399" r="28" fill="{DOT}"/>'
P.append(("09-monograma", "Monograma S", "Una S hecha de dos compartimentos que no se tocan.", s))

# 10 · Recinto: lo mínimo; un punto aislado dentro de su espacio
s = '<rect x="262" y="262" width="500" height="500" rx="140" fill="none" stroke="url(#n)" stroke-width="40"/>'
s += '<rect x="262" y="262" width="500" height="500" rx="140" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="40"/>'
s += piece('<circle cx="512" cy="512" r="110" fill="url(#a)"/>')
P.append(("10-recinto", "Recinto", "Lo más abstracto: un perfil aislado en su espacio.", s))

# ---------- Segunda tanda: 11 a 20 ----------

# 11 · Pestañas: un navegador con tres pestañas; la activa en cian
s = piece('<rect x="236" y="352" width="552" height="420" rx="56" fill="url(#n2)"/>')
for x, f in [(252, "n"), (612, "n"), (432, "a")]:
    s += piece(f'<path d="M{x} 400 V300 Q{x} 252 {x + 48} 252 H{x + 112} Q{x + 160} 252 {x + 160} 300 V400 Z" fill="url(#{f})"/>')
s += '<rect x="236" y="384" width="552" height="40" fill="url(#a)"/>'
for i, w in enumerate((420, 340, 380)):
    s += f'<rect x="300" y="{480 + i * 72}" width="{w}" height="26" rx="13" fill="#3a5fc9" opacity=".7"/>'
s += f'<circle cx="512" cy="312" r="26" fill="{DOT}"/>'
P.append(("11-pestanas", "Pestañas", "Un navegador con tres pestañas; la activa, en cian.", s))

# 12 · Candado: el perfil protegido
s = '<path d="M372 470 V380 Q372 240 512 240 Q652 240 652 380 V470" fill="none" stroke="url(#n)" stroke-width="64" stroke-linecap="round"/>'
s += piece('<rect x="296" y="446" width="432" height="334" rx="72" fill="url(#a)"/>')
s += f'<circle cx="512" cy="580" r="40" fill="{DOT}"/><rect x="494" y="590" width="36" height="96" rx="18" fill="{DOT}"/>'
P.append(("12-candado", "Candado", "Cada perfil, bajo llave: sesión privada.", s))

# 13 · Bóveda: puerta de caja fuerte con centro activo
s = piece('<circle cx="512" cy="512" r="262" fill="url(#n)"/>')
s += '<circle cx="512" cy="512" r="190" fill="url(#n2)"/>'
for ang in (0, 120, 240):
    s += f'<rect x="496" y="352" width="32" height="160" rx="16" fill="#3a5fc9" transform="rotate({ang} 512 512)"/>'
s += piece('<circle cx="512" cy="512" r="78" fill="url(#a)"/>')
s += f'<circle cx="512" cy="512" r="26" fill="{DOT}"/>'
for ang in range(0, 360, 45):
    x = 512 + 226 * math.cos(math.radians(ang))
    y = 512 + 226 * math.sin(math.radians(ang))
    s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="10" fill="#0d1d4a"/>'
P.append(("13-boveda", "Bóveda", "Una caja fuerte: los datos de cada perfil, guardados.", s))

# 14 · Escudo dividido: dos mitades separadas, una activa
SHIELD = "M512 236 L752 312 V500 Q752 700 512 800 Q272 700 272 500 V312 Z"
s = '<clipPath id="izq"><rect x="0" y="0" width="494" height="1024"/></clipPath><clipPath id="der"><rect x="530" y="0" width="494" height="1024"/></clipPath>'
s += '<g filter="url(#sh)">'
s += f'<path d="{SHIELD}" fill="url(#n)" clip-path="url(#izq)"/><path d="{SHIELD}" fill="url(#a)" clip-path="url(#der)"/>'
s += "</g>"
s += f'<path d="{SHIELD}" fill="url(#hl)" clip-path="url(#der)"/><path d="{SHIELD}" fill="url(#hl)" clip-path="url(#izq)"/>'
s += f'<circle cx="640" cy="470" r="34" fill="{DOT}"/>'
P.append(("14-escudo", "Escudo", "Protección partida en dos: nada pasa de un lado al otro.", s))

# 15 · Puerta: una puerta entreabierta con luz cian
s = piece('<rect x="300" y="236" width="424" height="560" rx="48" fill="url(#n2)"/>')
s += '<rect x="344" y="280" width="336" height="516" rx="20" fill="url(#a)"/>'
s += piece('<path d="M344 280 L560 324 V796 L344 796 Z" fill="url(#n)"/>')
s += f'<circle cx="520" cy="560" r="20" fill="{DOT}"/>'
P.append(("15-puerta", "Puerta", "Una puerta que se abre a un perfil; la luz, la sesión.", s))

# 16 · Cubo: tres caras separadas; la de arriba, activa
s = '<g filter="url(#sh)">'
s += '<path d="M512 250 L742 382 L512 514 L282 382 Z" fill="url(#a)"/>'
s += '<path d="M268 410 L496 542 V800 L268 668 Z" fill="url(#n)"/>'
s += '<path d="M756 410 L528 542 V800 L756 668 Z" fill="url(#n2)"/>'
s += "</g>"
s += f'<ellipse cx="512" cy="382" rx="52" ry="30" fill="{DOT}"/>'
P.append(("16-cubo", "Cubo", "Un bloque de caras que no se tocan; la de arriba, activa.", s))

# 17 · Vista aérea: tres silos vistos desde arriba
s = ""
for cx, cy, rr, f in [(382, 614, 104, "n"), (642, 614, 104, "n"), (512, 386, 124, "a")]:
    s += piece(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="url(#{f})"/>')
    s += f'<circle cx="{cx}" cy="{cy}" r="{rr * 0.62:.0f}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="10"/>'
s += f'<circle cx="512" cy="386" r="30" fill="{DOT}"/>'
P.append(("17-aerea", "Vista aérea", "Tres silos vistos desde arriba; el más grande, activo.", s))

# 18 · Personas: tres perfiles; el del frente, activo
s = ""
for cx, f, sc in [(352, "n2", 0.82), (672, "n2", 0.82), (512, "a", 1.0)]:
    head_r = 92 * sc
    head_y = 430 if sc == 1 else 460
    body_y = head_y + head_r + 36
    w = 220 * sc
    s += piece(
        f'<circle cx="{cx}" cy="{head_y}" r="{head_r:.0f}" fill="url(#{f})"/>'
        f'<path d="M{cx - w / 2:.0f} 780 V{body_y + 70:.0f} Q{cx - w / 2:.0f} {body_y:.0f} {cx - w / 2 + 70:.0f} {body_y:.0f} H{cx + w / 2 - 70:.0f} Q{cx + w / 2:.0f} {body_y:.0f} {cx + w / 2:.0f} {body_y + 70:.0f} V780 Z" fill="url(#{f})"/>'
    )
P.append(("18-personas", "Personas", "Varias cuentas, una al frente: la que estás usando.", s))

# 19 · S recortada: una celda activa con la S en negativo
s = piece('<rect x="276" y="276" width="472" height="472" rx="132" fill="url(#a)"/>')
s += f'<path d="M628 398 Q628 352 582 352 H446 Q396 352 396 404 Q396 456 446 456 H578 Q628 456 628 510 V520 Q628 572 578 572 H442 Q396 572 396 526" fill="none" stroke="{DOT}" stroke-width="58" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 48)"/>'
P.append(("19-s-recortada", "S recortada", "Un compartimento con la S de Silo calada.", s))

# 20 · Cumbres: tres picos separados; el central, nevado en cian
s = '<g filter="url(#sh)">'
s += '<path d="M236 760 L392 470 Q404 448 416 470 L552 760 Z" fill="url(#n2)"/>'
s += '<path d="M472 760 L632 440 Q644 418 656 440 L788 760 Z" fill="url(#n)"/>'
s += '<path d="M352 760 L498 300 Q512 260 526 300 L672 760 Z" fill="url(#n)"/>'
s += "</g>"
s += '<path d="M446 464 L498 300 Q512 260 526 300 L578 464 L548 440 L512 470 L476 440 Z" fill="url(#a)"/>'
P.append(("20-cumbres", "Cumbres", "Lo más abstracto: picos aislados, la cima activa.", s))

for name, _, _, body in P:
    open(f"{name}.svg", "w").write(svg(body))

cells = "".join(
    f'<div class="c"><span class="n">{i + 1:02d}</span><img class="big" src="{f}.svg">'
    f'<div class="row"><div class="dock dark"><img src="{f}.svg" width="64"><img src="{f}.svg" width="32"></div>'
    f'<div class="dock light"><img src="{f}.svg" width="64"><img src="{f}.svg" width="32"></div></div>'
    f"<b>{t}</b><p>{d}</p></div>"
    for i, (f, t, d, _) in enumerate(P)
)
open("sheet-10.html", "w").write(
    """<!doctype html><meta charset=utf-8><style>
body{margin:0;padding:28px;background:#0b0c10;color:#eef1f6;font:500 14px -apple-system,sans-serif}
h1{font-size:15px;margin:0 0 4px}.sub{color:#8d96a6;font-size:12.5px;margin:0 0 18px;display:flex;justify-content:space-between}
.g{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.c{position:relative;background:#14161c;border:1px solid #ffffff14;border-radius:12px;padding:14px;text-align:center}
.n{position:absolute;top:10px;left:12px;font:500 11px ui-monospace,monospace;color:#6b7486}
.big{width:100%}.row{display:flex;gap:8px;margin:6px 0 12px}
.dock{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 0;border-radius:8px}
.dark{background:#050608}.light{background:#e6e9ef}b{font-size:15px}p{color:#9aa3b2;font-size:12.5px;margin:6px 0 0}
</style><h1>Silo · 20 propuestas · paleta Glaciar</h1><div class="sub"><span>← más concreto</span><span>más abstracto →</span></div><div class="g">"""
    + cells
    + "</div>"
)
print("ok", len(P))
