"""Etapa 3: reglas de Natalia pasadas al FAQ y búsqueda por reglas corregida. Sin red.

Los tests de ReglasDeBusquedaTests usan la base real (SQLite en memoria con las tablas de
Supabase) a través de procesar_mensaje_usuario, para que cada bug se pueda comprobar
también contra el código anterior.
"""
import re
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.db import OperationalError

from api.models import Causa

from . import busqueda, faq, servicio
from .test_ia import NO_ENTENDI_ONG, NO_ENTENDI_VOLUNTARIO, con_ias, ia_falsa
from .utiles_test import ConBase, SinRed, procesar


def sin_ia():
    """Las dos IAs caídas: lo que se responde sale de las reglas."""
    return con_ias(ia_falsa("Groq", falla=True), ia_falsa("Gemini", falla=True))


class ReglasDeBusquedaTests(ConBase):
    def responder(self, texto):
        with sin_ia():
            return procesar(texto)[0]

    # ── bugs de Natalia ──

    def test_el_recuento_cuenta_solo_las_abiertas(self):
        # En la base hay 3 de salud en Palermo: 1 abierta, 1 cancelada y 1 finalizada
        r = self.responder("¿hay convocatorias de salud en Palermo?")
        self.assertIn("Encontré 1 convocatoria abierta de Salud y Primeros Auxilios en Palermo", r)

    def test_muestra_el_nombre_de_la_organizacion(self):
        r = self.responder("¿dónde puedo ayudar con salud en Palermo?")
        self.assertIn("«Jornada de salud» de Cruz Roja Argentina", r)
        self.assertIn("Sede central", r)

    def test_ong_en_revision_se_incluye_y_se_marca(self):
        r = self.responder("¿dónde hay convocatorias de animales?")
        self.assertIn("«Paseo de perros» de Patitas Felices (en revisión)", r)
        self.assertIn("Plaza Moreno", r)

    def test_la_plata_es_un_lugar_no_plata_de_donaciones(self):
        r = self.responder("voluntariados en La Plata")
        self.assertIn("Encontré 1 convocatoria abierta en La Plata", r)
        self.assertNotIn("donaci", r.lower())

    def test_los_turnos_no_se_detectan_por_substrings(self):
        # "cambiar" tiene "am", "19" y "8" tienen dígitos: antes eso activaba el turno mañana
        for texto in ("Quiero cambiar mi contraseña", "Tengo 19 años y quiero ayudar", "Somos 8 amigos y una abuela"):
            r = self.responder(texto)
            self.assertEqual(r, NO_ENTENDI_VOLUNTARIO, texto)

    def test_turnos_por_frase_o_por_hora_explicita(self):
        self.assertIn("Encontré 1 convocatoria abierta de Salud y Primeros Auxilios por la mañana", self.responder("convocatorias de salud por la mañana"))
        self.assertIn("No encontré convocatorias abiertas de Salud y Primeros Auxilios por la tarde", self.responder("convocatorias de salud por la tarde"))
        self.assertIn("Encontré 2 convocatorias abiertas por la tarde", self.responder("convocatorias a las 15 hs"))
        self.assertIn("Encontré 2 convocatorias abiertas por la tarde", self.responder("convocatorias a las 3pm"))

    def test_mañana_sola_es_el_dia_no_el_turno(self):
        r = self.responder("convocatorias de salud mañana")
        self.assertNotIn("por la mañana", r)

    def test_un_lugar_que_no_esta_en_la_lista_lo_dice(self):
        for texto in ("convocatorias en Rosario", "¿qué hay en Rosario?", "quiero ayudar en Mar del Plata"):
            r = self.responder(texto)
            self.assertIn("No encontré convocatorias abiertas en «", r, texto)
        self.assertIn("«Rosario»", self.responder("convocatorias en Rosario"))
        self.assertIn("«Mar del Plata»", self.responder("quiero ayudar en Mar del Plata"))

    def test_un_en_cualquiera_no_es_un_lugar(self):
        for texto in ("¿cómo me registro en la sección de ayuda?", "¿cómo busco voluntariados en la app?", "no entiendo nada en serio"):
            self.assertEqual(self.responder(texto), NO_ENTENDI_VOLUNTARIO, texto)

    def test_fecha_exacta_y_dia_de_la_semana(self):
        self.assertIn("Encontré 2 convocatorias abiertas los sábados", self.responder("convocatorias el sábado"))
        self.assertIn("Encontré 1 convocatoria abierta para el 15/11/2026", self.responder("convocatorias para el 15/11/2026"))
        self.assertIn("No pude entender esa fecha", self.responder("convocatorias para el 31/02/2026"))

    def test_lugar_y_turno_sin_resultados_explica_que_hay_por_separado(self):
        r = self.responder("voluntariados en La Plata por la mañana")
        self.assertIn("No encontré convocatorias abiertas en La Plata por la mañana", r)
        self.assertIn("Hay 1 en La Plata en otros horarios y 1 por la mañana en otras zonas", r)

    def test_causas_y_lugares_salen_de_la_base_no_de_una_lista_fija(self):
        Causa.objects.create(id=9, nombre="Astronomía y Divulgación")
        r = self.responder("convocatorias de astronomía")
        self.assertIn("No encontré convocatorias abiertas de Astronomía y Divulgación", r)

    def test_sin_causa_en_la_base_no_se_inventa_una(self):
        # "Animales" no es una causa de la tabla: se usa la que existe ("Protección Animal")
        r = self.responder("convocatorias de animales")
        self.assertIn("de Protección Animal", r)
        self.assertNotIn("de Animales", r)

    def test_sin_texto_de_desarrollo_ni_voseo_roto_ni_markdown(self):
        textos = ("convocatorias de salud en Palermo", "¿dónde hay convocatorias de animales?", "voluntariados en La Plata",
                  "convocatorias en Rosario", "convocatorias el sábado", "horario de convocatorias de salud")
        for texto in textos:
            r = self.responder(texto)
            for prohibido in ("entorno local", "Podes ", "ubicación simulada", "**", "organizaciones"):
                self.assertNotIn(prohibido, r, f"{texto} -> {r}")

    def test_pide_horario(self):
        r = self.responder("¿cuándo es la convocatoria de salud en Palermo?")
        self.assertIn("14/11/2026 a las 10:00", r)

    # ── cortesías ──

    def test_una_cortesia_no_tapa_la_pregunta(self):
        with con_ias(ia_falsa("Groq", "vol-cancelar"), ia_falsa("Gemini")):
            r, _ = procesar("hola, ¿cómo cancelo mi postulación?")
            self.assertEqual(r, faq.respuesta_directa("¿Cómo cancelo mi postulación?", "voluntario"))
            # "holanda" y "cholas" contienen "hola" como substring, pero no son un saludo
            r, _ = procesar("quiero ser voluntario en holanda")
            self.assertNotEqual(r, "¡Hola! ¿En qué te puedo ayudar hoy con tus voluntariados?")

    # ── la base falla ──

    def test_si_la_base_falla_no_se_traga_en_silencio_y_el_flujo_sigue(self):
        def base_caida():
            raise OperationalError("no hay conexión")

        with patch.object(busqueda, "nombres_de_causas", base_caida), sin_ia():
            r, log = procesar("convocatorias de salud en Palermo")
        self.assertEqual(r, NO_ENTENDI_VOLUNTARIO)
        self.assertIn("Búsqueda por reglas no disponible: OperationalError", log)

    def test_la_ong_no_busca_convocatorias(self):
        with sin_ia():
            r, _ = procesar("convocatorias de salud en Palermo", vista="ong")
        self.assertEqual(r, NO_ENTENDI_ONG)


class ChipsDelBotTests(SinRed):
    """Cada chip de js/bot.js tiene que resolverse por el FAQ, sin IA y sin las reglas viejas."""

    @staticmethod
    def chips():
        js = (Path(settings.BASE_DIR).parent / "js" / "bot.js").read_text(encoding="utf-8")
        bloque_ong = js.split("if (esVistaOng) {")[1].split("} else {")[0]
        bloque_voluntario = js.split("} else {")[1].split("// Inyección")[0]
        patron = re.compile(r"enviarPreguntaRapida\('([^']+)'\)")
        return {"ong": patron.findall(bloque_ong), "voluntario": patron.findall(bloque_voluntario)}

    def test_hay_chips_en_las_dos_vistas(self):
        chips = self.chips()
        self.assertGreaterEqual(len(chips["ong"]), 5)
        self.assertGreaterEqual(len(chips["voluntario"]), 5)

    def test_cada_chip_responde_con_el_faq_sin_ia(self):
        llamadas = []
        with con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)):
            for vista, preguntas in self.chips().items():
                for pregunta in preguntas:
                    r, _ = procesar(pregunta, vista=vista)
                    esperado = faq.respuesta_directa(pregunta, vista)
                    self.assertIsNotNone(esperado, f"{vista}: el chip «{pregunta}» no está en el FAQ")
                    self.assertEqual(r, esperado, pregunta)
                    self.assertNotEqual(r, NO_ENTENDI_ONG if vista == "ong" else NO_ENTENDI_VOLUNTARIO)
        self.assertEqual(llamadas, [])

    def test_las_respuestas_usan_los_nombres_reales_de_la_interfaz(self):
        # El panel real de la ONG se llama Mi Perfil / Mis Convocatorias (no Vacantes / Solicitudes)
        todo = " ".join(e["respuesta"] for e in faq.entradas_faq("ong"))
        self.assertIn("Mis Convocatorias", todo)
        self.assertIn("Mi Perfil", todo)
        self.assertNotIn("Vacantes", todo)
        self.assertNotIn("Solicitudes", todo)
        for vista in ("voluntario", "ong"):
            for texto in (servicio.NO_ENTENDI[vista],):
                self.assertNotIn("Podes", texto)
                self.assertNotIn("vacantes", texto)
