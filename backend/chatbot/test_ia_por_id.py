"""Fallback conversacional: la IA solo elige el id de la entrada del FAQ y el código devuelve la
"respuesta" exacta de esa entrada. Nunca llega texto escrito por la IA. Sin red."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from . import faq, ia
from .test_ia import NO_ENTENDI_VOLUNTARIO, SIN_REGLA, con_ias, ia_falsa, respuesta_del_faq
from .utiles_test import SinRed, procesar

FRASE = ia.FRASE_SIN_RESPUESTA


def conversar(salida_de_la_ia, vista="voluntario", segunda=None, llamadas=None):
    with con_ias(ia_falsa("Groq", salida_de_la_ia, llamadas=llamadas), ia_falsa("Gemini", segunda or "gen-roles", llamadas=llamadas)):
        return procesar(SIN_REGLA, vista)


class SoloElIdTests(SinRed):
    def test_el_id_devuelve_la_respuesta_exacta_del_faq(self):
        for vista, id_ in (("voluntario", "vol-cancelar"), ("voluntario", "map-iconos"), ("voluntario", "gen-que-es"),
                           ("ong", "ong-asistencia"), ("ong", "gen-roles")):
            r, log = conversar(id_, vista)
            self.assertEqual(r, respuesta_del_faq(id_), id_)
            self.assertIn(f"entrada {id_}", log)

    def test_la_respuesta_es_identica_caracter_por_caracter(self):
        r, _ = conversar("vol-postulacion-pendiente")
        self.assertEqual(r.encode(), respuesta_del_faq("vol-postulacion-pendiente").encode())  # incluso con ⏳ y ✓

    def test_comillas_backticks_mayusculas_y_puntos_se_toleran(self):
        esperado = respuesta_del_faq("vol-cancelar")
        for salida in ('"vol-cancelar"', "`vol-cancelar`", "'vol-cancelar'", "VOL-CANCELAR", " vol-cancelar.\n", "“vol-cancelar”", "vol-cancelar\n\n"):
            r, _ = conversar(salida)
            self.assertEqual(r, esperado, repr(salida))

    def test_un_texto_libre_se_descarta_aunque_tenga_sentido(self):
        parafrasis = [
            "Si no lo estáis, podéis cancelar desde Mis participaciones.",
            respuesta_del_faq("vol-cancelar"),                      # la respuesta correcta pero como texto
            respuesta_del_faq("vol-cancelar").replace("podés", "puedes"),
            "La respuesta es vol-cancelar",                           # el id metido en una frase
            "vol-cancelar vol-sin-cupos",                             # dos ids
            "vol-cancelar\nPodés cancelar desde Mis participaciones.",
            "Tocá Mis participaciones.",
        ]
        for salida in parafrasis:
            r, _ = conversar(salida)
            self.assertEqual(r, FRASE, salida)

    def test_un_id_inexistente_es_sin_respuesta(self):
        for salida in ("vol-no-existe", "vol-", "cancelar", "x", "gen-roles-2", "vol_cancelar"):
            r, _ = conversar(salida)
            self.assertEqual(r, FRASE, salida)

    def test_un_id_de_otra_vista_es_sin_respuesta(self):
        r, _ = conversar("ong-publicar", "voluntario")
        self.assertEqual(r, FRASE)
        r, _ = conversar("vol-cancelar", "ong")
        self.assertEqual(r, FRASE)
        r, _ = conversar("map-iconos", "ong")  # las entradas de map- son solo de voluntarios
        self.assertEqual(r, FRASE)

    def test_sin_respuesta_gana_aunque_venga_con_un_id(self):
        r, _ = conversar("vol-cancelar SIN_RESPUESTA")
        self.assertEqual(r, FRASE)
        r, _ = conversar("sin_respuesta")
        self.assertEqual(r, FRASE)

    def test_un_id_invalido_no_gasta_otra_ia_pero_un_error_si_pasa_a_la_siguiente(self):
        llamadas = []
        conversar("texto libre cualquiera", llamadas=llamadas)
        self.assertEqual([l[0] for l in llamadas], ["Groq"])
        llamadas = []
        with con_ias(ia_falsa("Groq", falla=True, llamadas=llamadas), ia_falsa("Gemini", "vol-cancelar", llamadas=llamadas)):
            r, _ = procesar(SIN_REGLA)
        self.assertEqual([l[0] for l in llamadas], ["Groq", "Gemini"])
        self.assertEqual(r, respuesta_del_faq("vol-cancelar"))

    def test_las_entradas_con_verificar_no_se_pueden_elegir(self):
        datos = [
            {"id": "gen-a", "preguntas": ["¿a?"], "respuesta": "Confirmada."},
            {"id": "gen-b", "preguntas": ["¿b?"], "respuesta": "[VERIFICAR] Sin confirmar."},
        ]
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        ruta = Path(carpeta.name) / "faq.json"
        ruta.write_text(json.dumps(datos), encoding="utf-8")
        llamadas = []
        with patch.object(faq, "RUTA_FAQ", ruta):
            r_ok, _ = conversar("gen-a", llamadas=llamadas)
            r_mal, _ = conversar("gen-b")
        self.assertEqual(r_ok, "Confirmada.")
        self.assertEqual(r_mal, FRASE)
        self.assertNotIn("gen-b", llamadas[0][2])
        self.assertNotIn("Sin confirmar", llamadas[0][2])

    def test_el_prompt_pide_solo_el_id_y_no_texto(self):
        llamadas = []
        conversar("vol-cancelar", llamadas=llamadas)
        prompt = llamadas[0][2]
        self.assertIn("únicamente el id", prompt)
        self.assertIn("tal cual está escrito", prompt)
        self.assertIn("SIN_RESPUESTA", prompt)
        self.assertNotIn("1 a 3 oraciones", prompt)  # ya no se le pide que escriba
        self.assertNotIn("voseo", prompt)
        ids = [e["id"] for e in faq.entradas_faq("voluntario")]
        self.assertTrue(all(f"id: {i}\n" in prompt for i in ids))

    def test_el_resto_del_flujo_sigue_igual(self):
        with con_ias(ia_falsa("Groq", falla=True), ia_falsa("Gemini", falla=True)):
            r, _ = procesar(SIN_REGLA)
        self.assertEqual(r, NO_ENTENDI_VOLUNTARIO)
        r, _ = procesar("hola")
        self.assertTrue(r.startswith("¡Hola!"))
