"""Lectura de faq.json: la base de conocimiento del chatbot."""
import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

RUTA_FAQ = Path(__file__).with_name("faq.json")

# El prefijo del id dice para quién es la entrada: gen = todos, vol = voluntarios, ong = ONGs, map = mapa
PREFIJOS_POR_VISTA = {
    "voluntario": ("gen-", "vol-", "map-"),
    "ong": ("gen-", "ong-"),
}

# Una respuesta con esta marca todavía no la confirmó el equipo: nunca se le muestra a un usuario
MARCA_SIN_VERIFICAR = "[VERIFICAR]"


@lru_cache(maxsize=4)
def _leer(ruta):
    try:
        with open(ruta, encoding="utf-8") as archivo:
            datos = json.load(archivo)
    except (OSError, ValueError) as e:
        print(f"[CHATBOT] No se pudo leer el FAQ: {type(e).__name__}")
        return ()
    if not isinstance(datos, list):
        return ()
    return tuple(
        e for e in datos
        if isinstance(e, dict)
        and isinstance(e.get("id"), str)
        and isinstance(e.get("respuesta"), str)
        and e["respuesta"].strip()
        and MARCA_SIN_VERIFICAR not in e["respuesta"]
    )


def entradas_faq(vista):
    """Entradas del FAQ para esa vista ("voluntario" u "ong"), sin las que tienen [VERIFICAR]."""
    prefijos = PREFIJOS_POR_VISTA["voluntario" if vista == "voluntario" else "ong"]
    return [e for e in _leer(RUTA_FAQ) if e["id"].startswith(prefijos)]


# ──────────────────────────────────────────────────────────────
# Respuesta directa: cuando el mensaje coincide FUERTE con una entrada, se devuelve su
# "respuesta" tal cual, sin IA. Se prioriza la precisión: una respuesta directa equivocada
# es peor que pasar a la IA, así que ante cualquier duda (poca coincidencia o más de una
# entrada candidata) no se responde acá.
#
# Coincide fuerte si ocurre alguna de estas dos cosas:
#  1. El mensaje, normalizado, es igual a una de las "preguntas" de la entrada (los chips).
#  2. Tiene al menos 2 palabras significativas y, para alguna "pregunta" de la entrada:
#       - pureza: TODAS sus palabras significativas están en esa pregunta o en las
#         palabras_clave de la entrada (no hay palabras que la entrada no conozca), y
#       - cobertura: nombra al menos el 75 % de las palabras significativas de la pregunta.
#  Y además tiene que haber una sola entrada candidata (si hay dos, es ambiguo).
#
# Se comparan palabras completas, sin tildes ni mayúsculas. Nunca substrings ("don" no es
# "donde") ni prefijos.
# ──────────────────────────────────────────────────────────────

MIN_PALABRAS = 2
COBERTURA_MINIMA = 0.75

# Palabras que no ayudan a distinguir una pregunta de otra. "no", "puedo", "quiero" o "hay"
# NO están: cambian el sentido de la pregunta.
PALABRAS_VACIAS = frozenset(
    "a al algo ante con como cual cuales de del el ella ellos en es esa ese eso esta este esto "
    "la las le les lo los me mi mis nos o para por que se si sin su sus te tu tus u un una uno unas unos y".split()
)


def normalizar(texto):
    """Minúsculas, sin tildes y solo letras, números y espacios."""
    sin_tildes = unicodedata.normalize("NFD", str(texto or ""))
    sin_tildes = "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", sin_tildes.lower()).split())


def palabras_significativas(texto_normalizado):
    return {p for p in texto_normalizado.split() if p not in PALABRAS_VACIAS}


@lru_cache(maxsize=4)
def _indice(ruta):
    """Por entrada: (entrada, [(frase normalizada, palabras significativas)], palabras de las palabras_clave)."""
    indice = []
    for entrada in _leer(ruta):
        preguntas = entrada.get("preguntas")
        claves = entrada.get("palabras_clave")
        frases = []
        for pregunta in preguntas if isinstance(preguntas, list) else []:
            if isinstance(pregunta, str) and normalizar(pregunta):
                frase = normalizar(pregunta)
                frases.append((frase, frozenset(palabras_significativas(frase))))
        palabras_clave = set()
        for clave in claves if isinstance(claves, list) else []:
            if isinstance(clave, str):
                palabras_clave |= palabras_significativas(normalizar(clave))
        indice.append((entrada, frases, frozenset(palabras_clave)))
    return tuple(indice)


def _coincide(palabras_usuario, palabras_pregunta, palabras_clave):
    if not palabras_pregunta or not palabras_usuario <= (palabras_pregunta | palabras_clave):
        return False
    return len(palabras_usuario & palabras_pregunta) / len(palabras_pregunta) >= COBERTURA_MINIMA


def respuesta_directa(texto, vista):
    """La "respuesta" de la entrada que coincide fuerte con el mensaje, o None."""
    frase_usuario = normalizar(texto)
    if not frase_usuario:
        return None
    palabras_usuario = palabras_significativas(frase_usuario)
    prefijos = PREFIJOS_POR_VISTA["voluntario" if vista == "voluntario" else "ong"]

    exactas, parciales = [], []
    for entrada, frases, palabras_clave in _indice(RUTA_FAQ):
        if not entrada["id"].startswith(prefijos):
            continue
        if any(frase_usuario == frase for frase, _ in frases):
            exactas.append(entrada)
        elif len(palabras_usuario) >= MIN_PALABRAS and any(
            _coincide(palabras_usuario, palabras, palabras_clave) for _, palabras in frases
        ):
            parciales.append(entrada)

    candidatas = exactas or parciales
    return candidatas[0]["respuesta"] if len(candidatas) == 1 else None
