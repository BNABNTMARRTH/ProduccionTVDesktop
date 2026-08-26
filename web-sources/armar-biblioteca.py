#!/usr/bin/env python3
"""Convierte las respuestas de NotebookLM en el archivo de datos de la
biblioteca de la app. Une los renglones partidos y separa por secciones."""
import sys, re, json, os

S = sys.argv[1]
FICHAS = [
    ("narrativo", "Guion narrativo", "Ficción: corto, serie o pieza con historia",
     "2. Guion y narrativa"),
    ("comercial", "Comercial o spot", "Publicidad: vender una idea en poco tiempo",
     "3. Comerciales, spots y videoclips"),
    ("videoclip", "Videoclip musical", "Imagen al servicio de una canción",
     "3. Comerciales, spots y videoclips"),
    ("tiktok", "Video para TikTok", "Vertical, corto y pensado para el algoritmo",
     "4. TikTok, formato vertical y algoritmo"),
    ("reel", "Reel de Instagram", "Vertical de marca o creador",
     "5. Instagram, influencers y marca"),
    ("envivo", "Transmisión en vivo", "Programa que sale al aire sin edición",
     "6. Twitch y transmisión en vivo"),
    ("rodaje", "Preparar el rodaje", "Equipo, set y organización antes de grabar",
     "1. Producción audiovisual"),
]
CAMPOS = ["POR-DONDE-EMPEZAR", "PASOS", "ESTRUCTURA", "DURACION", "ERRORES", "REVISA"]
LLAVE = {"POR-DONDE-EMPEZAR": "empezar", "PASOS": "pasos", "ESTRUCTURA": "estructura",
         "DURACION": "duracion", "ERRORES": "errores", "REVISA": "revisa"}

def unir(texto):
    """El CLI envuelve a 80 columnas: vuelve a unir cada párrafo o viñeta."""
    fuera = []
    for linea in texto.split("\n"):
        l = linea.rstrip()
        if not l.strip():
            fuera.append(""); continue
        # una viñeta o número empieza renglón nuevo; lo demás continúa el anterior
        if re.match(r'^\s*(\d+[\.\)]|[-•*·]|[A-ZÁÉÍÓÚÑ\-]{4,}:)', l) or not fuera or fuera[-1] == "":
            fuera.append(l.strip())
        else:
            fuera[-1] = fuera[-1] + " " + l.strip()
    return "\n".join(fuera)

def limpiar(t):
    t = re.sub(r'^\s*(\d+[\.\)]|[-•*·])\s*', '', t).strip()
    t = re.sub(r'\s*\[[\d,\s]+\]', '', t)      # citas numeradas sueltas
    t = re.sub(r'\*\*(.+?)\*\*', r'\1', t)     # negritas de markdown
    return re.sub(r'\s+', ' ', t).strip()

def partir(texto):
    texto = unir(texto)
    texto = re.sub(r'^\s*Answer:\s*', '', texto)
    texto = re.sub(r'\nResumed conversation:.*$', '', texto, flags=re.S)
    pos = []
    for c in CAMPOS:
        m = re.search(rf'^{re.escape(c)}\s*:', texto, re.M)
        if m: pos.append((m.start(), m.end(), c))
    pos.sort()
    out = {}
    for i, (ini, fin, campo) in enumerate(pos):
        cuerpo = texto[fin: pos[i+1][0] if i+1 < len(pos) else len(texto)].strip()
        if campo in ("POR-DONDE-EMPEZAR", "DURACION"):
            out[LLAVE[campo]] = limpiar(cuerpo.replace("\n", " "))
        else:
            items = [limpiar(l) for l in cuerpo.split("\n") if limpiar(l)]
            out[LLAVE[campo]] = [i for i in items if len(i) > 3]
    return out

fichas = []
for clave, titulo, resumen, cuaderno in FICHAS:
    ruta = f"{S}/saber/{clave}.txt"
    if not os.path.exists(ruta) or os.path.getsize(ruta) == 0:
        print(f"  falta {clave}"); continue
    d = partir(open(ruta, encoding="utf-8", errors="replace").read())
    faltan = [k for k in LLAVE.values() if not d.get(k)]
    print(f"  {clave:10} {'ok' if not faltan else 'incompleto: ' + ','.join(faltan)}")
    fichas.append({"id": clave, "titulo": titulo, "resumen": resumen,
                   "fuente": cuaderno, **d})

with open(f"{S}/biblioteca-datos.json", "w", encoding="utf-8") as f:
    json.dump(fichas, f, ensure_ascii=False, indent=1)
print(f"\nfichas armadas: {len(fichas)}")

# Escribe el archivo que consume la herramienta de la app.
DESTINO = ("/Users/aldomaster666/Documents/Codex/2026-06-30/build-ios-apps-plugin-build-ios/"
           "work/ProduccionTVDesktop/frontend/public/tools/biblioteca/datos.js")
cabecera = """// Fichas de la Biblioteca. NO se edita a mano: se genera a partir de las
// respuestas de los cuadernos de NotebookLM (ver web-sources/README.md).
//
// Cada ficha responde lo mismo para un tipo de pieza: por dónde empezar, los
// pasos, cómo se arma, cuánto dura, los errores típicos y una lista para
// revisar el borrador. El campo `fuente` dice de qué cuaderno salió.
window.BIBLIOTECA = """
with open(DESTINO, "w", encoding="utf-8") as f:
    f.write(cabecera + json.dumps(fichas, ensure_ascii=False, indent=2) + ";\n")
print(f"escrito: {DESTINO}")
