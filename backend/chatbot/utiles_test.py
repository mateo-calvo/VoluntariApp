"""Utilidades compartidas por los tests del chatbot (no es un módulo de tests).

Ningún test sale a la red: httpx y genai quedan bloqueados. Los tests que no necesitan la
base heredan de SimpleTestCase (cualquier consulta a la base los hace fallar); los que sí
usan ConBase, que crea en SQLite en memoria las tablas de las vistas/modelos que en
producción viven en Supabase (managed=False), así se prueba con el ORM real.
"""
import contextlib
import io
import uuid
from datetime import date, time
from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test import SimpleTestCase, TestCase

from api.models import Causa, Convocatoria, Localidad, Ong, Provincia

from . import busqueda, ia, servicio


class BloqueaRed:
    """Bloquea la red y limpia las cachés (la de Django y la de nombres de la base)."""

    def setUp(self):
        super().setUp()
        sin_red = AssertionError("Un test intentó salir a la red")
        for objetivo in ("chatbot.proveedor_groq.httpx.post", "chatbot.proveedor.genai.Client"):
            p = patch(objetivo, side_effect=sin_red)
            p.start()
            self.addCleanup(p.stop)
        cache.clear()
        busqueda._cache.clear()
        self.addCleanup(cache.clear)
        self.addCleanup(busqueda._cache.clear)


class SinRed(BloqueaRed, SimpleTestCase):
    """Sin base: la búsqueda por reglas ve una base vacía (sin causas ni lugares)."""

    def setUp(self):
        super().setUp()
        # Cada módulo importó estos nombres por su cuenta: hay que reemplazarlos en todos
        for modulo in (busqueda, servicio, ia):
            for nombre in ("nombres_de_causas", "lugares_disponibles"):
                if hasattr(modulo, nombre):
                    p = patch.object(modulo, nombre, lambda: [])
                    p.start()
                    self.addCleanup(p.stop)


MODELOS_SIN_MIGRAR = (Provincia, Localidad, Causa, Ong, Convocatoria)  # en orden de dependencia


class ConBase(BloqueaRed, TestCase):
    """Con las tablas de Supabase creadas y datos de ejemplo (ver crear_datos)."""

    @classmethod
    def setUpClass(cls):
        # Antes de que TestCase abra la transacción: SQLite no deja crear tablas con las FK activas dentro de una
        with connection.schema_editor() as editor:
            for modelo in MODELOS_SIN_MIGRAR:
                editor.create_model(modelo)
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        with connection.schema_editor() as editor:
            for modelo in reversed(MODELOS_SIN_MIGRAR):
                editor.delete_model(modelo)

    @classmethod
    def setUpTestData(cls):
        crear_datos(cls)


# 2026-11-14 es sábado y 2026-11-15 domingo
SABADO, DOMINGO = date(2026, 11, 14), date(2026, 11, 15)


def crear_datos(cls):
    """Provincias, lugares, causas, dos ONGs (una en revisión) y convocatorias en distintos estados."""
    buenos_aires = Provincia.objects.create(id=1, nombre="Buenos Aires")
    caba = Provincia.objects.create(id=2, nombre="Ciudad Autónoma de Buenos Aires")
    cls.la_plata = Localidad.objects.create(id=1, nombre="La Plata", provincia=buenos_aires)
    cls.palermo = Localidad.objects.create(id=2, nombre="Palermo", provincia=caba)
    cls.la_boca = Localidad.objects.create(id=3, nombre="La Boca", provincia=caba)
    cls.salud = Causa.objects.create(id=1, nombre="Salud y Primeros Auxilios")
    cls.animales = Causa.objects.create(id=2, nombre="Protección Animal")
    cls.comedores = Causa.objects.create(id=3, nombre="Comedores y Alimentación")
    cls.cruz_roja = Ong.objects.create(id=uuid.uuid4(), nombre_organizacion="Cruz Roja Argentina", esta_verificada=True)
    cls.patitas = Ong.objects.create(id=uuid.uuid4(), nombre_organizacion="Patitas Felices", esta_verificada=False)

    def convocatoria(titulo, ong, causa, localidad, dia, hora, estado="ABIERTA", lugar="Sede central"):
        return Convocatoria.objects.create(
            ong=ong, causa=causa, localidad=localidad, provincia=localidad.provincia, titulo=titulo,
            fecha=dia, hora=hora, estado=estado, lugar=lugar,
        )

    cls.c_salud = convocatoria("Jornada de salud", cls.cruz_roja, cls.salud, cls.palermo, SABADO, time(10, 0))
    convocatoria("Jornada de salud (cancelada)", cls.cruz_roja, cls.salud, cls.palermo, SABADO, time(10, 0), "CANCELADA")
    convocatoria("Jornada de salud (finalizada)", cls.cruz_roja, cls.salud, cls.palermo, SABADO, time(10, 0), "FINALIZADA")
    cls.c_perros = convocatoria("Paseo de perros", cls.patitas, cls.animales, cls.la_plata, DOMINGO, time(15, 0), lugar="Plaza Moreno")
    cls.c_comedor = convocatoria("Merendero", cls.cruz_roja, cls.comedores, cls.la_boca, SABADO, time(15, 30))


def procesar(texto, vista="voluntario", **extra):
    """procesar_mensaje_usuario capturando lo que imprime (los logs [CHATBOT]). Devuelve (respuesta, log)."""
    salida = io.StringIO()
    with contextlib.redirect_stdout(salida):
        r = servicio.procesar_mensaje_usuario([{"role": "user", "parts": [{"text": texto}]}], vista, **extra)
    return r, salida.getvalue()
