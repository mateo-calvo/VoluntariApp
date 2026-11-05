"""Utilidades compartidas por los tests del chatbot (no es un módulo de tests).

Ningún test sale a la red: httpx y genai quedan bloqueados, y como los tests heredan de
SimpleTestCase, cualquier consulta a la base hace fallar el test.
"""
import contextlib
import io
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from . import servicio


class SinRed(SimpleTestCase):
    """Base de los tests: bloquea la red y limpia la caché."""

    def setUp(self):
        sin_red = AssertionError("Un test intentó salir a la red")
        for objetivo in ("chatbot.proveedor_groq.httpx.post", "chatbot.proveedor.genai.Client"):
            p = patch(objetivo, side_effect=sin_red)
            p.start()
            self.addCleanup(p.stop)
        cache.clear()
        self.addCleanup(cache.clear)


def procesar(texto, vista="voluntario", **extra):
    """procesar_mensaje_usuario capturando lo que imprime (los logs [CHATBOT]). Devuelve (respuesta, log)."""
    salida = io.StringIO()
    with contextlib.redirect_stdout(salida):
        r = servicio.procesar_mensaje_usuario([{"role": "user", "parts": [{"text": texto}]}], vista, **extra)
    return r, salida.getvalue()
