"""Etapa 2: respuesta directa del FAQ (sin IA) cuando el mensaje coincide fuerte. Sin red."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from . import faq
from .test_ia import SIN_REGLA, con_ias, ia_falsa
from .utiles_test import SinRed, procesar


def entrada(id_):
    return next(e for e in faq._leer(faq.RUTA_FAQ) if e["id"] == id_)


class CriterioTests(SinRed):
    def test_cada_pregunta_del_faq_devuelve_su_propia_respuesta(self):
        """Valida los datos: ninguna pregunta puede pisar a otra entrada de su vista."""
        for vista in ("voluntario", "ong"):
            for e in faq.entradas_faq(vista):
                for pregunta in e["preguntas"]:
                    self.assertEqual(faq.respuesta_directa(pregunta, vista), e["respuesta"], f"{vista} / {e['id']} / {pregunta}")

    def test_sin_tildes_ni_mayusculas_ni_signos(self):
        esperado = entrada("map-en-revision")["respuesta"]
        for texto in ("¿Qué significa En revisión en el mapa?", "QUE SIGNIFICA EN REVISION EN EL MAPA", "que significa en revision en el mapa!!!"):
            self.assertEqual(faq.respuesta_directa(texto, "voluntario"), esperado, texto)

    def test_coincidencia_parcial_fuerte(self):
        # Todas sus palabras significativas están en la pregunta y cubre >= 75 % de ella
        self.assertEqual(faq.respuesta_directa("como me registro voluntario", "voluntario"), entrada("vol-registro")["respuesta"])
        self.assertEqual(faq.respuesta_directa("Donde veo participaciones", "voluntario"), entrada("vol-ver-participaciones")["respuesta"])

    def test_palabras_completas_nunca_substrings(self):
        # "dono" está en el FAQ; "donos", "donamos" o "don" no son esa palabra
        self.assertIsNone(faq.respuesta_directa("cómo donos a una ONG", "voluntario"))
        self.assertIsNone(faq.respuesta_directa("don", "voluntario"))
        self.assertIsNone(faq.respuesta_directa("quiero registrarme voluntario", "voluntario"))

    def test_una_sola_palabra_significativa_no_alcanza(self):
        self.assertIsNone(faq.respuesta_directa("registro", "voluntario"))
        self.assertIsNone(faq.respuesta_directa("¿cómo es el registro?", "voluntario"))

    def test_pregunta_exacta_corta_si_alcanza(self):
        # Igualdad exacta (los chips): vale aunque tenga una sola palabra significativa
        self.assertEqual(faq.respuesta_directa("¿Es gratis?", "voluntario"), entrada("gen-gratis")["respuesta"])

    def test_poca_cobertura_no_es_fuerte(self):
        # Parecida a "Creé la cuenta pero no puedo entrar" (confirmar email), pero cubre 4 de 6 palabras:
        # podría ser la contraseña olvidada, así que no se responde directo
        self.assertIsNone(faq.respuesta_directa("no puedo entrar a mi cuenta", "voluntario"))

    def test_palabras_que_la_entrada_no_conoce_no_son_fuerte(self):
        self.assertIsNone(faq.respuesta_directa("como me registro voluntario si tengo 15 años", "voluntario"))

    def test_cada_vista_ve_solo_sus_entradas(self):
        self.assertIsNone(faq.respuesta_directa("¿Cómo publico una convocatoria?", "voluntario"))
        self.assertIsNone(faq.respuesta_directa("¿Cómo me postulo a una convocatoria?", "ong"))
        self.assertEqual(faq.respuesta_directa("¿Cómo publico una convocatoria?", "ong"), entrada("ong-publicar")["respuesta"])

    def test_dos_entradas_candidatas_es_ambiguo(self):
        datos = [
            {"id": "gen-a", "preguntas": ["¿Cómo funciona esto?"], "palabras_clave": [], "respuesta": "A"},
            {"id": "gen-b", "preguntas": ["¿Cómo funciona esto?"], "palabras_clave": [], "respuesta": "B"},
            {"id": "gen-c", "preguntas": ["¿Dónde queda la sede central?"], "palabras_clave": [], "respuesta": "C"},
        ]
        with self._faq(datos):
            self.assertIsNone(faq.respuesta_directa("¿Cómo funciona esto?", "voluntario"))  # exacta en dos
            self.assertEqual(faq.respuesta_directa("dónde queda sede central", "voluntario"), "C")

    def test_entradas_con_verificar_no_se_responden(self):
        datos = [{"id": "gen-a", "preguntas": ["¿Cuánto cuesta el plan premium?"], "palabras_clave": [], "respuesta": "[VERIFICAR] Nada."}]
        with self._faq(datos):
            self.assertIsNone(faq.respuesta_directa("¿Cuánto cuesta el plan premium?", "voluntario"))

    def test_entradas_malformadas_no_rompen(self):
        datos = [
            {"id": "gen-a", "respuesta": "Sin preguntas ni palabras clave."},
            {"id": "gen-b", "preguntas": "no es lista", "palabras_clave": 5, "respuesta": "Rara."},
            {"id": "gen-c", "preguntas": [None, 3, "¿Hola mundo cruel?"], "palabras_clave": [None], "respuesta": "Bien."},
        ]
        with self._faq(datos):
            self.assertEqual(faq.respuesta_directa("¿Hola mundo cruel?", "voluntario"), "Bien.")
            self.assertIsNone(faq.respuesta_directa("", "voluntario"))
            self.assertIsNone(faq.respuesta_directa("¿¿¿???", "voluntario"))

    def _faq(self, datos):
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        ruta = Path(carpeta.name) / "faq.json"
        ruta.write_text(json.dumps(datos), encoding="utf-8")
        return patch.object(faq, "RUTA_FAQ", ruta)


class FlujoTests(SinRed):
    def test_el_faq_directo_va_antes_de_las_reglas_de_natalia_y_no_gasta_ia(self):
        llamadas = []
        # Estas preguntas son del FAQ pero las reglas de Natalia, por substrings, las
        # contestaban otra cosa ("plata" de "plataforma" -> donaciones; "donde" -> ubicaciones)
        casos = {
            "¿Cómo funciona la plataforma?": "gen-que-es",
            "¿Para qué sirve esta app?": "gen-que-es",
            "¿Dónde veo mis participaciones?": "vol-ver-participaciones",
        }
        with con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)):
            for pregunta, id_ in casos.items():
                r, _ = procesar(pregunta)
                self.assertEqual(r, entrada(id_)["respuesta"], pregunta)
        self.assertEqual(llamadas, [])

    def test_en_la_vista_ong_responde_con_las_entradas_de_ong(self):
        r, _ = procesar("¿Cómo marco que un voluntario asistió?", vista="ong")
        self.assertEqual(r, entrada("ong-asistencia")["respuesta"])

    def test_sin_coincidencia_fuerte_sigue_el_flujo_normal(self):
        # Una regla de Natalia (no es del FAQ): sigue contestando ella
        r, _ = procesar("hola")
        self.assertEqual(r, "¡Hola! ¿En qué te puedo ayudar hoy con tus voluntariados?")
        # Ni regla ni FAQ: la IA
        with con_ias(ia_falsa("Groq", "gen-roles"), ia_falsa("Gemini")):
            r, _ = procesar(SIN_REGLA)
        self.assertEqual(r, entrada("gen-roles")["respuesta"])
