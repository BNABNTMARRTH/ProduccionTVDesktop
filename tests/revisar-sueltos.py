#!/usr/bin/env python3
"""Caza VARIABLES SUELTAS en los módulos del generador.

Una variable suelta es un nombre que un archivo USA pero no importa ni define.
`npm run build` NO las detecta (solo truenan al usar la app, p. ej. al hacer
clic en un botón), así que este chequeo las busca comparando cada archivo
contra el vocabulario compartido del proyecto: todo lo que declaran a nivel
superior los módulos de web-sources/generador-tv/src.

Uso (desde la raíz del repo):
    python3 tests/revisar-sueltos.py            # revisa todos los módulos
    python3 tests/revisar-sueltos.py VistaSet.jsx

Sale con código 1 si encuentra algo sospechoso. No es un compilador: puede dar
algún falso positivo (una palabra del vocabulario que aparece como texto visible
de la pantalla), así que revisa el nombre marcado antes de cambiar nada.

Probado contra un caso real: si a VistaSet.jsx se le quita la importación de
reacomodoDe (el botón "Reacomodar automáticamente"), `npm run build` sigue
diciendo "built" y este chequeo sí lo marca.
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "web-sources" / "generador-tv" / "src"

DEF = re.compile(r"^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)", re.M)
EXPORT_LIST = re.compile(r"^export\s*\{([^}]*)\}", re.M)
IMPORT_BLOCK = re.compile(r"^import\s+(.+?)\s+from\s+[\"'][^\"']+[\"'];", re.M | re.S)


def solo_codigo(texto):
    """Quita comentarios, cadenas y el texto visible del JSX."""
    texto = re.sub(r"/\*.*?\*/", " ", texto, flags=re.S)
    texto = re.sub(r"//[^\n]*", " ", texto)
    # Las cadenas de una línea no pueden cruzar saltos de línea: así una comilla
    # suelta (en un texto en español, p. ej.) no se come el resto del archivo.
    texto = re.sub(r"\"(?:[^\"\\\n]|\\.)*\"", " ", texto)
    texto = re.sub(r"'(?:[^'\\\n]|\\.)*'", " ", texto)
    # Dentro de plantillas `...` solo sobrevive lo interpolado en ${...}.
    texto = re.sub(r"`((?:[^`\\]|\\.)*)`", lambda m: " ".join(re.findall(r"\$\{([^{}]*)\}", m.group(1))), texto)
    # Texto visible entre etiquetas JSX. Se excluyen los signos de código para
    # no comerse comparaciones sueltas del tipo `a > b ... c < d`.
    texto = re.sub(r">[^<>{};=&|?]*<", "><", texto)
    return texto


def vocabulario_compartido():
    nombres = set()
    for f in sorted(SRC.glob("*.js*")):
        texto = f.read_text()
        nombres |= set(DEF.findall(texto))
        for grupo in EXPORT_LIST.findall(texto):
            nombres |= {n.strip().split(" as ")[-1].strip() for n in grupo.split(",") if n.strip()}
    return nombres


def revisar(f, vocabulario):
    crudo = f.read_text()
    # Los imports se leen del texto ORIGINAL: solo_codigo borra las comillas de
    # la ruta ("./sets.js") y dejaría de reconocerlos.
    importados = set()
    for bloque in IMPORT_BLOCK.findall(crudo):
        importados |= set(re.findall(r"[A-Za-z_$][\w$]*", bloque)) - {"as", "from"}
    texto = solo_codigo(crudo)
    definidos = set(DEF.findall(texto))
    palabras = set(re.findall(r"\b[A-Za-z_$][\w$]*\b", texto))
    candidatos = sorted((palabras & vocabulario) - importados - definidos)
    # Descarta los que el archivo declara dentro de una función, los que recibe
    # desestructurados (const { x } = ...) y los parámetros de una función.
    def declarado(n):
        e = re.escape(n)
        return (re.search(r"\b(?:const|let|var|function)\s+" + e + r"\b", texto)
                or re.search(r"(?:const|let|var)\s*\{[^{}]*\b" + e + r"\b[^{}]*\}\s*=", texto)
                or re.search(r"(?:function\s+\w+|=>|\bfunction)?\s*\([^()]*\b" + e + r"\b[^()]*\)\s*(?:=>|\{)", texto))
    return [n for n in candidatos if not declarado(n)]


def main():
    vocabulario = vocabulario_compartido()
    archivos = [SRC / n for n in sys.argv[1:]] if len(sys.argv) > 1 else sorted(SRC.glob("*.js*"))
    fallos = 0
    for f in archivos:
        sueltos = revisar(f, vocabulario)
        if sueltos:
            fallos += 1
        print(f"{'OK  ' if not sueltos else 'OJO '} {f.name:<28} {'limpio' if not sueltos else 'sueltos: ' + ', '.join(sueltos)}")
    print(f"\n{len(archivos)} archivos revisados · {fallos} con avisos")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
