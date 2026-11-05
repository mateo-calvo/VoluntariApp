"""Etapa 4: búsqueda de convocatorias con IA (la IA interpreta, el código arma la lista). Sin red.

Las funciones puras y el flujo completo usan filas en memoria; la consulta real a la vista del
mapa (VistaConvocatoriasMapa) se prueba aparte con SQLite.
"""
import json
import uuid
from datetime import date, time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.db import OperationalError, connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from api.models import VistaConvocatoriasMapa

from . import busqueda, ia, servicio
from .test_ia import SIN_REGLA, con_ias, ia_falsa, respuesta_del_faq
from .utiles_test import BloqueaRed, ConBase, SinRed, procesar

HOY = date(2026, 10, 26)  # lunes
AHORA = time(15, 0)
CABA, BA = "Ciudad Autónoma de Buenos Aires", "Buenos Aires"
CAUSAS = ["Comedores y Alimentación", "Educación y Apoyo Escolar", "Medio Ambiente y Reciclaje",
          "Protección Animal", "Salud y Primeros Auxilios"]
LUGARES = ["Palermo", "La Boca", "La Plata", "La Matanza", "Ezeiza", "Arrecifes", "San Martín", BA, CABA]


def fila(titulo, localidad, provincia, causa, dia, hora=time(10, 0), lat=None, lng=None, verificada=True, libres=4):
    return {"convocatoria_id": uuid.uuid4(), "titulo": titulo, "nombre_organizacion": f"ONG {titulo}",
            "ong_verificada": verificada, "causa_nombre": causa, "localidad_nombre": localidad,
            "provincia_nombre": provincia, "fecha": dia, "hora": hora, "lugares_libres": libres,
            "latitud": Decimal(str(lat)) if lat is not None else None,
            "longitud": Decimal(str(lng)) if lng is not None else None}


FILAS = [
    fila("Hoy temprano", "La Plata", BA, "Comedores y Alimentación", HOY, time(11, 0)),
    fila("Hoy sin hora", "La Plata", BA, "Comedores y Alimentación", HOY, None),
    fila("Hoy tarde", "La Plata", BA, "Comedores y Alimentación", HOY, time(18, 0)),
    fila("Perros Palermo", "Palermo", CABA, "Protección Animal", HOY + timedelta(1), lat=-34.58, lng=-58.42),
    fila("Gatos La Boca", "La Boca", CABA, "Protección Animal", HOY + timedelta(5), time(9, 0), -34.635, -58.363, verificada=False),
    fila("Merendero Palermo", "Palermo", CABA, "Comedores y Alimentación", HOY + timedelta(1), lat=-34.579, lng=-58.425),
    fila("Reciclaje Ezeiza", "Ezeiza", BA, "Medio Ambiente y Reciclaje", HOY + timedelta(6), lat=-34.854, lng=-58.523),
]
PROHIBIDOS = {"latitud", "longitud", "descripcion", "ong_email_contacto", "ong_link_donacion"}


class ConFilas(SinRed):
    """Base de la tabla de ejemplo: nombres de causas y lugares fijos y filas en memoria."""

    def setUp(self):
        super().setUp()
        for modulo in (busqueda, servicio, ia):
            for nombre, valor in (("nombres_de_causas", lambda: CAUSAS), ("lugares_disponibles", lambda: LUGARES)):
                if hasattr(modulo, nombre):
                    p = patch.object(modulo, nombre, valor)
                    p.start()
                    self.addCleanup(p.stop)
        for nombre, valor in (("_filas_abiertas", lambda: [dict(f) for f in FILAS]),
                              ("hoy", lambda: HOY), ("ahora", lambda: AHORA)):
            p = patch.object(busqueda, nombre, valor)
            p.start()
            self.addCleanup(p.stop)


def json_ia(**filtros):
    base = {"causa": None, "tema": None, "lugar": None, "fecha_desde": None, "fecha_hasta": None}
    base.update(filtros)
    return json.dumps(base)


class FechasTests(ConFilas):
    def test_fechas_relativas(self):
        casos = {
            "hoy": (HOY, HOY), "mañana": (date(2026, 10, 27), date(2026, 10, 27)),
            "pasado mañana": (date(2026, 10, 28), date(2026, 10, 28)),
            "el sábado": (date(2026, 10, 31), date(2026, 10, 31)),
            "el lunes": (HOY, HOY),
            "este finde": (date(2026, 10, 31), date(2026, 11, 1)),
            "2026-11-02": (date(2026, 11, 2), date(2026, 11, 2)),
        }
        for expresion, esperado in casos.items():
            self.assertEqual(busqueda.resolver_fecha(expresion), esperado, expresion)

    def test_a_la_manana_no_es_manana_y_lo_ininteligible_es_none(self):
        self.assertIsNone(busqueda.resolver_fecha("a la mañana"))
        self.assertIsNone(busqueda.resolver_fecha("2026-02-31"))
        self.assertIsNone(busqueda.resolver_fecha("cuando quieras"))


class BuscarConvocatoriasTests(ConFilas):
    def titulos(self, **filtros):
        return [c["titulo"] for c in busqueda.buscar_convocatorias(**filtros)]

    def test_hoy_solo_si_la_hora_no_paso(self):
        todos = self.titulos(limite=10)
        self.assertIn("Hoy tarde", todos)          # 18:00, son las 15:00
        self.assertNotIn("Hoy temprano", todos)    # 11:00 ya pasó
        self.assertNotIn("Hoy sin hora", todos)    # sin hora no se puede asegurar

    def test_filtros(self):
        self.assertEqual(self.titulos(lugar="Palermo", limite=10), ["Perros Palermo", "Merendero Palermo"])
        self.assertEqual(self.titulos(lugar=CABA, causa="Protección Animal", limite=10), ["Perros Palermo", "Gatos La Boca"])
        self.assertEqual(self.titulos(causa="animales", limite=10), ["Perros Palermo", "Gatos La Boca"])
        self.assertEqual(self.titulos(fecha_desde="2026-10-27", fecha_hasta="2026-10-27", limite=10), ["Perros Palermo", "Merendero Palermo"])

    def test_filtro_que_no_se_puede_aplicar_da_vacio(self):
        for filtros in ({"lugar": "Rosario"}, {"causa": "Astronomía"}, {"fecha_desde": "cuando quieras"},
                        {"lugar": "Palermo", "causa": "Salud y Primeros Auxilios"}):
            self.assertEqual(busqueda.buscar_convocatorias(**filtros), [], filtros)

    def test_distancia_orden_y_campos_permitidos(self):
        con = busqueda.buscar_convocatorias(lat=-34.58, lng=-58.42, limite=10)
        self.assertEqual(con[0]["titulo"], "Perros Palermo")
        self.assertEqual(con[0]["distancia_km"], 0.0)
        kms = [c["distancia_km"] for c in con if "distancia_km" in c]
        self.assertEqual(kms, sorted(kms))
        self.assertEqual(con[-1]["titulo"], "Hoy tarde")  # sin coordenadas, al final
        for c in busqueda.buscar_convocatorias(limite=10) + con:
            self.assertFalse(PROHIBIDOS & set(c), c)
        self.assertFalse(PROHIBIDOS & set(busqueda.CAMPOS_BASE) - {"latitud", "longitud"})

    def test_sin_ubicacion_o_con_ubicacion_invalida_se_ordena_por_fecha(self):
        esperado = self.titulos(limite=10)
        for lat, lng in ((None, None), (True, 1), ("x", 1), (91, 0), (0, 181), (float("nan"), 0), (10 ** 400, 0), (-34.6, None)):
            self.assertEqual(self.titulos(lat=lat, lng=lng, limite=10), esperado, (lat, lng))
        self.assertEqual(esperado[0], "Hoy tarde")

    def test_el_limite_se_acota(self):
        self.assertEqual(len(busqueda.buscar_convocatorias(limite=500)), 5)
        self.assertEqual(len(busqueda.buscar_convocatorias(limite="x")), 5)
        self.assertEqual(len(busqueda.buscar_convocatorias(limite=2)), 2)


class RespuestaFijaTests(ConFilas):
    def test_con_resultados_marca_las_ongs_en_revision(self):
        r = busqueda.formatear_respuesta_fija(busqueda.buscar_convocatorias(lugar="La Boca"))
        self.assertIn("«Gatos La Boca» de ONG Gatos La Boca (en revisión) (Protección Animal)", r)
        self.assertIn("Abrí el mapa y tocá una para ver el detalle y postularte.", r)

    def test_con_resultados_formato_y_resto(self):
        convocatorias = busqueda.buscar_convocatorias(limite=10)
        r = busqueda.formatear_respuesta_fija(convocatorias)
        self.assertTrue(r.startswith("Encontré estas convocatorias: "))
        self.assertIn(f"Y {len(convocatorias) - 3} más en el mapa.", r)
        self.assertNotIn("(en revisión)", busqueda.formatear_respuesta_fija(busqueda.buscar_convocatorias(lugar="Palermo")))

    def test_sin_resultados_dice_que_no_encontro(self):
        r = busqueda.formatear_respuesta_fija([], {"causa": None, "lugar": "Rosario", "fecha_desde": None, "fecha_hasta": None})
        self.assertIn("No encontré convocatorias abiertas en «Rosario».", r)
        r = busqueda.formatear_respuesta_fija([], {"causa": "Astronomía", "lugar": None, "fecha_desde": "2026-11-02", "fecha_hasta": "2026-11-02"})
        self.assertIn("de «Astronomía» para el 02/11", r)
        self.assertIn("las causas de la app son: Comedores y Alimentación", r)

    def test_texto_de_las_ongs_sin_html(self):
        c = busqueda.buscar_convocatorias(lugar="Ezeiza")[0]
        c["titulo"] = "<script>alert(1)</script>" + "x" * 500
        r = busqueda.formatear_respuesta_fija([c])
        self.assertNotIn("<", r)
        self.assertNotIn(">", r)
        self.assertLess(len(r), 600)


class ValidarFiltrosIaTests(ConFilas):
    def validar(self, crudo):
        return busqueda.validar_filtros_ia(crudo, CAUSAS, LUGARES)

    def test_json_valido(self):
        f = self.validar(json_ia(causa="Protección Animal", lugar="la boca", fecha_desde="el sábado", fecha_hasta="el sábado"))
        self.assertEqual(f, {"causa": "Protección Animal", "lugar": "La Boca", "fecha_desde": "2026-10-31", "fecha_hasta": "2026-10-31"})
        self.assertEqual(self.validar("Claro:\n```json\n" + json_ia(lugar="caba") + "\n```")["lugar"], CABA)
        self.assertEqual(self.validar(json_ia(fecha_desde="este finde", fecha_hasta="este finde"))["fecha_hasta"], "2026-11-01")

    def test_tema_sin_causa_y_lugar_inexistente_se_conservan_para_decirlo(self):
        f = self.validar(json_ia(tema="astronomía", lugar="Rosario"))
        self.assertEqual((f["causa"], f["lugar"]), ("astronomía", "Rosario"))
        self.assertIsNone(self.validar(json_ia(tema="voluntariado"))["causa"])  # un tema vacío no es un tema

    def test_invalidos(self):
        malos = [None, 5, "", "sin llaves", "{roto", "[1, 2]", '"texto"', json_ia(causa="Astronomía"),
                 json_ia(lugar="x" * 61), json_ia(causa=5), json_ia(fecha_desde="cuando quieras"), json_ia(fecha_desde="2026-02-31")]
        for crudo in malos:
            self.assertIsNone(self.validar(crudo), crudo)


class EsBusquedaTests(ConFilas):
    def test_pide_convocatorias(self):
        for texto in ("¿hay voluntariados en Palermo?", "convocatorias cerca", "¿qué hay en Rosario?", "quiero ayudar en Palermo",
                      "busco voluntariados de animales", "¿dónde puedo ayudar?", "algo en CABA"):
            self.assertTrue(busqueda.es_busqueda(texto, LUGARES), texto)

    def test_no_pide_convocatorias(self):
        for texto in ("¿cómo me postulo?", "¿cómo cancelo una postulación?", "hola", "¿qué significan los íconos?",
                      "¿cómo me registro en la sección de ayuda?", "¿cómo busco voluntariados en la app?"):
            self.assertFalse(busqueda.es_busqueda(texto, LUGARES), texto)


class FlujoConIaTests(ConFilas):
    def ias(self, groq_json=None, gemini_json=None, groq_falla=False, gemini_falla=False, llamadas=None, conversacional="TEXTO LIBRE DE LA IA"):
        """conversacional: lo que contestan las IAs en el fallback conversacional (un id del FAQ);
        groq_json / gemini_json: lo que contestan al interpretar una búsqueda."""
        return con_ias(
            ia_falsa("Groq", conversacional, falla=groq_falla, llamadas=llamadas, respuesta_json=groq_json or "{}"),
            ia_falsa("Gemini", conversacional, falla=gemini_falla, llamadas=llamadas, respuesta_json=gemini_json or "{}"),
        )

    def test_la_ia_interpreta_y_el_codigo_arma_la_lista(self):
        llamadas = []
        with self.ias(groq_json=json_ia(causa="Protección Animal", lugar="Palermo"), llamadas=llamadas):
            r, log = procesar("¿hay voluntariados de animales en Palermo?")
        self.assertIn("Encontré estas convocatorias: «Perros Palermo» de ONG Perros Palermo (Protección Animal), en Palermo", r)
        self.assertNotIn("TEXTO LIBRE", r)  # lo que escriba la IA nunca llega a la respuesta
        self.assertEqual([l[0] for l in llamadas], ["Groq"])
        self.assertIn("Búsqueda interpretada por Groq", log)
        prompt = llamadas[0][2]
        self.assertIn("Hoy es lunes 2026-10-26", prompt)
        self.assertIn("Protección Animal", prompt)

    def test_si_groq_falla_interpreta_gemini(self):
        with self.ias(gemini_json=json_ia(lugar="Ezeiza"), groq_falla=True):
            r, log = procesar("¿hay voluntariados en Ezeiza?")
        self.assertIn("«Reciclaje Ezeiza»", r)
        self.assertIn("interpretada por Gemini", log)

    def test_un_filtro_imposible_da_lista_vacia_y_lo_dice(self):
        with self.ias(groq_json=json_ia(lugar="Rosario")):
            r, _ = procesar("convocatorias en Rosario")
        self.assertEqual(r, busqueda.formatear_respuesta_fija([], {"lugar": "Rosario", "causa": None, "fecha_desde": None, "fecha_hasta": None}))
        self.assertIn("No encontré convocatorias abiertas en «Rosario»", r)
        with self.ias(groq_json=json_ia(tema="astronomía")):
            r, _ = procesar("busco voluntariados de astronomía")
        self.assertIn("No encontré convocatorias abiertas de «astronomía»", r)
        self.assertIn("las causas de la app son", r)

    def test_json_invalido_no_gasta_otra_ia_y_usa_las_reglas(self):
        llamadas = []
        with self.ias(groq_json="esto no es json", llamadas=llamadas), \
                patch.object(servicio, "responder_busqueda_por_reglas", lambda texto: "RESPUESTA DE LAS REGLAS"):
            r, log = procesar("convocatorias en Palermo")
        self.assertEqual(r, "RESPUESTA DE LAS REGLAS")
        self.assertEqual([l[0] for l in llamadas], ["Groq"])
        self.assertIn("devolvió un JSON inválido", log)

    def test_si_fallan_las_dos_ias_usa_la_busqueda_por_reglas_de_natalia(self):
        with self.ias(groq_falla=True, gemini_falla=True), \
                patch.object(servicio, "responder_busqueda_por_reglas", lambda texto: "RESPUESTA DE LAS REGLAS"):
            r, log = procesar("convocatorias en Palermo")
        self.assertEqual(r, "RESPUESTA DE LAS REGLAS")
        self.assertIn("uso las reglas", log)

    def test_pidio_convocatorias_sin_filtros_y_sin_ia_lista_las_proximas_o_cercanas(self):
        with self.ias(groq_falla=True, gemini_falla=True), patch.object(servicio, "responder_busqueda_por_reglas", lambda texto: None):
            r, _ = procesar("¿hay voluntariados cerca?")
            self.assertTrue(r.startswith("Encontré estas convocatorias: «Hoy tarde»"), r)
            r, _ = procesar("¿hay voluntariados cerca?", lat=-34.58, lng=-58.42)
            self.assertTrue(r.startswith("Encontré estas convocatorias: «Perros Palermo»"), r)
            self.assertIn("a 0,0 km", r)

    def test_la_ubicacion_ordena_pero_no_sale_ni_se_loguea(self):
        llamadas = []
        with self.ias(groq_json=json_ia(), llamadas=llamadas):
            r, log = procesar("¿qué hay cerca?", lat=-34.58, lng=-58.42)
        self.assertTrue(r.startswith("Encontré estas convocatorias: «Perros Palermo»"), r)
        self.assertIn("ubicación: sí", log)
        for texto in [log] + [repr(l) for l in llamadas]:
            for numero in ("34.58", "58.42", "-34.58"):
                self.assertNotIn(numero, texto)

    def test_lo_que_no_es_una_busqueda_va_al_faq_no_a_la_busqueda(self):
        llamadas = []
        with self.ias(llamadas=llamadas, conversacional="gen-roles"):
            r, _ = procesar(SIN_REGLA)
        self.assertEqual(r, respuesta_del_faq("gen-roles"))
        self.assertEqual(len(llamadas), 1)
        self.assertNotIn("Hoy es", llamadas[0][2])  # el prompt del FAQ, no el de extracción

    def test_base_caida_sigue_con_el_resto_del_flujo(self):
        def base_caida():
            raise OperationalError("sin conexión")

        with self.ias(groq_json=json_ia(lugar="Palermo"), conversacional="gen-roles"), patch.object(busqueda, "_filas_abiertas", base_caida):
            r, log = procesar("convocatorias en Palermo")
        self.assertIn("Búsqueda no disponible: OperationalError", log)
        self.assertEqual(r, respuesta_del_faq("gen-roles"))  # sigue con la IA conversacional

    def test_la_ong_no_busca(self):
        llamadas = []
        with self.ias(groq_json=json_ia(lugar="Palermo"), llamadas=llamadas, conversacional="gen-roles"):
            r, _ = procesar("convocatorias en Palermo", vista="ong")
        self.assertEqual(r, respuesta_del_faq("gen-roles"))
        self.assertNotIn("Hoy es", llamadas[0][2])


def fila_vista(titulo, **cambios):
    datos = dict(
        convocatoria_id=uuid.uuid4(), titulo=titulo, descripcion="Descripción privada", fecha=date(2026, 11, 20), hora=time(10, 0),
        lugar="Sede", direccion="Calle 1", latitud=Decimal("-34.600000"), longitud=Decimal("-58.400000"), cupos_totales=10,
        inscriptos_actuales=2, lugares_libres=8, horas_estimadas=4, requiere_aprobacion=False, estado_convocatoria="ABIERTA",
        ong_id=uuid.uuid4(), nombre_organizacion="ONG", ong_verificada=True, ong_email_contacto="privado@ong.org",
        ong_link_donacion="https://mpago.la/x", causa_id=1, causa_nombre="Salud", localidad_id=1, localidad_nombre="Palermo",
        provincia_id=1, provincia_nombre=CABA,
    )
    datos.update(cambios)
    return VistaConvocatoriasMapa(**datos)


class VistaDelMapaTests(ConBase):
    """La consulta real (ORM) sobre la vista que usa el mapa."""

    @classmethod
    def setUpClass(cls):
        with connection.schema_editor() as editor:
            editor.create_model(VistaConvocatoriasMapa)
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        with connection.schema_editor() as editor:
            editor.delete_model(VistaConvocatoriasMapa)

    def setUp(self):
        super().setUp()
        for nombre, valor in (("hoy", lambda: date(2026, 11, 4)), ("ahora", lambda: time(15, 0))):
            p = patch.object(busqueda, nombre, valor)
            p.start()
            self.addCleanup(p.stop)

    def test_solo_abiertas_con_lugares_libres_y_vigentes_incluidas_las_ongs_en_revision(self):
        fila_vista("Abierta").save(force_insert=True)
        fila_vista("En revisión", ong_verificada=False).save(force_insert=True)
        fila_vista("Cancelada", estado_convocatoria="CANCELADA").save(force_insert=True)
        fila_vista("Completa", estado_convocatoria="COMPLETA").save(force_insert=True)
        fila_vista("Sin lugares", lugares_libres=0).save(force_insert=True)
        fila_vista("Pasada", fecha=date(2026, 11, 3)).save(force_insert=True)
        fila_vista("Sin fecha", fecha=None).save(force_insert=True)
        fila_vista("Hoy ya pasó", fecha=date(2026, 11, 4), hora=time(9, 0)).save(force_insert=True)
        fila_vista("Hoy todavía", fecha=date(2026, 11, 4), hora=time(18, 0)).save(force_insert=True)

        titulos = sorted(c["titulo"] for c in busqueda.buscar_convocatorias(limite=10))
        self.assertEqual(titulos, ["Abierta", "En revisión", "Hoy todavía"])
        for c in busqueda.buscar_convocatorias(limite=10):
            self.assertFalse(PROHIBIDOS & set(c))
        en_revision = [c for c in busqueda.buscar_convocatorias(limite=10) if c["titulo"] == "En revisión"][0]
        self.assertIs(en_revision["ong_verificada"], False)

    def test_la_consulta_nunca_pide_descripcion_ni_email_ni_link_de_donacion(self):
        fila_vista("Con datos privados").save(force_insert=True)
        with CaptureQueriesContext(connection) as consultas:
            busqueda._filas_abiertas()
        self.assertEqual(len(consultas.captured_queries), 1)
        sql = consultas.captured_queries[0]["sql"].lower()
        for columna in ("descripcion", "ong_email_contacto", "ong_link_donacion"):
            self.assertNotIn(columna, sql)
        self.assertIn("titulo", sql)  # y sí pide las columnas permitidas


class ViewsTests(BloqueaRed, TestCase):
    def test_lat_y_lng_llegan_al_servicio(self):
        capturado = {}

        def falso(historial, vista, lat=None, lng=None):
            capturado.update(vista=vista, lat=lat, lng=lng)
            return "ok"

        with patch("chatbot.views.procesar_mensaje_usuario", falso):
            res = self.client.post("/api/chat/", json.dumps({"mensaje": "hola", "vista": "voluntario", "lat": -34.6, "lng": -58.4}),
                                   content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(capturado, {"vista": "voluntario", "lat": -34.6, "lng": -58.4})
