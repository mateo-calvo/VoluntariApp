"""Lectura de faq.json: la base de conocimiento del chatbot."""
import json
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
