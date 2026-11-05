"""Etapa 1: IA de respaldo (Groq y Gemini) cuando las reglas no entienden. Sin red."""
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import httpx
from google.genai import errors as genai_errors
from google.genai import types

from . import faq, ia, proveedor, proveedor_groq, servicio
from .proveedor_groq import ProveedorError
from .utiles_test import SinRed, procesar

def respuesta_del_faq(id_):
    return next(e["respuesta"] for e in faq._leer(faq.RUTA_FAQ) if e["id"] == id_)


# El mensaje de último recurso (el "No entendí" de Natalia, ahora con los nombres reales de la interfaz)
NO_ENTENDI_VOLUNTARIO = servicio.NO_ENTENDI["voluntario"]
NO_ENTENDI_ONG = servicio.NO_ENTENDI["ong"]
SIN_REGLA = "blablabla xyz"  # ni FAQ, ni cortesía, ni búsqueda: solo queda la IA


def ia_falsa(nombre, texto="respuesta de la ia", falla=False, llamadas=None, respuesta_json="{}"):
    """IA de mentira. En modo_json (interpretación de búsquedas) devuelve respuesta_json."""
    def proveedor_falso(historial, prompt, modo_json=False):
        if llamadas is not None:
            llamadas.append((nombre, historial, prompt))
        if falla:
            raise ProveedorError(f"{nombre} falló: 503")
        return respuesta_json if modo_json else texto
    return proveedor_falso


def con_ias(groq, gemini):
    """Reemplaza las dos IAs de la cadena."""
    return patch.multiple("chatbot.ia", obtener_respuesta_groq=groq, obtener_respuesta_gemini=gemini)


class CortesiasNoLlamanALaIaTests(SinRed):
    def test_las_cortesias_responden_igual_y_no_llaman_a_la_ia(self):
        llamadas = []
        with con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)):
            r, _ = procesar("hola")
            self.assertEqual(r, "¡Hola! ¿En qué te puedo ayudar hoy con tus voluntariados?")
            r, _ = procesar("hola", vista="ong")
            self.assertEqual(r, "¡Hola! ¿En qué te puedo ayudar hoy con la administración de tu ONG?")
            r, _ = procesar("muchas gracias!")
            self.assertEqual(r, "¡De nada! Estoy para ayudarte en lo que necesites dentro de VoluntariApp.")
            r, _ = procesar("chau", vista="ong")
            self.assertEqual(r, "¡Hasta luego! Éxitos en la gestión de tus convocatorias.")
        self.assertEqual(llamadas, [])


class IaConElFaqTests(SinRed):
    def test_mensaje_sin_regla_llama_a_groq_con_el_faq_en_el_prompt(self):
        llamadas = []
        with con_ias(ia_falsa("Groq", "vol-cancelar", llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)):
            r, log = procesar(SIN_REGLA)
        self.assertEqual(r, respuesta_del_faq("vol-cancelar"))  # la del FAQ, tal cual
        self.assertEqual([l[0] for l in llamadas], ["Groq"])  # Gemini no se gasta si Groq respondió
        _, historial, prompt = llamadas[0]
        self.assertEqual(historial, [{"role": "user", "parts": [{"text": SIN_REGLA}]}])
        self.assertIn("id: vol-cancelar", prompt)
        self.assertIn(respuesta_del_faq("vol-cancelar"), prompt)
        self.assertIn("únicamente el id", prompt)
        self.assertIn("SIN_RESPUESTA", prompt)
        self.assertIn("Respondió Groq", log)

    def test_el_prompt_lleva_solo_las_entradas_de_la_vista(self):
        todas = faq._leer(faq.RUTA_FAQ)
        vol = next(e for e in todas if e["id"].startswith("vol-"))
        ong = next(e for e in todas if e["id"].startswith("ong-"))
        for vista, debe, no_debe in (("voluntario", vol, ong), ("ong", ong, vol)):
            llamadas = []
            with con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini")):
                procesar(SIN_REGLA, vista)
            prompt = llamadas[0][2]
            self.assertIn(debe["respuesta"], prompt, vista)
            self.assertNotIn(no_debe["respuesta"], prompt, vista)
            self.assertIn(f"id: {debe['id']}\n", prompt, vista)
            self.assertNotIn(f"id: {no_debe['id']}\n", prompt, vista)

    def test_si_groq_falla_usa_gemini(self):
        llamadas = []
        with con_ias(ia_falsa("Groq", falla=True, llamadas=llamadas), ia_falsa("Gemini", "gen-roles", llamadas=llamadas)):
            r, log = procesar(SIN_REGLA)
        self.assertEqual(r, respuesta_del_faq("gen-roles"))
        self.assertEqual([l[0] for l in llamadas], ["Groq", "Gemini"])
        self.assertIn("Respondió Gemini", log)

    def test_si_fallan_las_dos_devuelve_el_no_entendi_original(self):
        for vista, original in (("voluntario", NO_ENTENDI_VOLUNTARIO), ("ong", NO_ENTENDI_ONG)):
            with con_ias(ia_falsa("Groq", falla=True), ia_falsa("Gemini", falla=True)):
                r, _ = procesar(SIN_REGLA, vista)
            self.assertEqual(r, original, vista)

    def test_sin_claves_configuradas_devuelve_el_original(self):
        # Sin mockear las IAs: las dos levantan ProveedorError por falta de claves y no hay red
        with patch.dict(os.environ, {}, clear=True):
            r, _ = procesar(SIN_REGLA)
        self.assertEqual(r, NO_ENTENDI_VOLUNTARIO)

    def test_sin_respuesta_en_cualquier_parte_se_reemplaza_por_la_frase_fija(self):
        for texto in ("SIN_RESPUESTA", "No sé. sin_respuesta por favor.", "Ehh... SIN RESPUESTA"):
            with con_ias(ia_falsa("Groq", texto), ia_falsa("Gemini")):
                r, _ = procesar(SIN_REGLA)
            self.assertEqual(r, ia.FRASE_SIN_RESPUESTA, texto)
        self.assertEqual(
            ia.FRASE_SIN_RESPUESTA,
            "Sobre eso no tengo información. Podés preguntarme cómo usar VoluntariApp: postularte, el mapa, tu cuenta o tu ONG.",
        )

    def test_el_mensaje_se_recorta_antes_de_ir_a_la_ia(self):
        llamadas = []
        with con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini")):
            procesar("blablabla xyz " * 300)
        enviado = llamadas[0][1][0]["parts"][0]["text"]
        self.assertLessEqual(len(enviado), ia.LARGO_MAXIMO_IA)


class FaqTests(SinRed):
    def _con_archivo(self, contenido):
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        ruta = Path(carpeta.name) / "faq.json"
        ruta.write_text(contenido, encoding="utf-8")
        return patch.object(faq, "RUTA_FAQ", ruta)

    def test_las_entradas_con_verificar_no_van_al_prompt(self):
        datos = [
            {"id": "gen-a", "preguntas": ["¿a?"], "respuesta": "Respuesta confirmada."},
            {"id": "gen-b", "preguntas": ["¿b?"], "respuesta": "[VERIFICAR] Respuesta pendiente."},
        ]
        llamadas = []
        with self._con_archivo(json.dumps(datos)), con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini")):
            procesar(SIN_REGLA)
        self.assertIn("Respuesta confirmada.", llamadas[0][2])
        self.assertNotIn("Respuesta pendiente.", llamadas[0][2])

    def test_faq_faltante_o_roto_no_llama_a_la_ia_y_devuelve_el_original(self):
        llamadas = []
        for contenido in ("esto no es json", '{"id": "no es una lista"}', "[]", "[1, 2]"):
            with self._con_archivo(contenido), con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)):
                r, _ = procesar(SIN_REGLA)
            self.assertEqual(r, NO_ENTENDI_VOLUNTARIO, contenido)
        with patch.object(faq, "RUTA_FAQ", Path("no/existe/faq.json")), con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)):
            r, _ = procesar(SIN_REGLA)
        self.assertEqual(r, NO_ENTENDI_VOLUNTARIO)
        self.assertEqual(llamadas, [])

    def test_el_faq_real_es_valido_y_no_tiene_verificar(self):
        todas = faq._leer(faq.RUTA_FAQ)
        crudo = json.loads(faq.RUTA_FAQ.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(todas), 30)
        self.assertEqual(len(todas), len(crudo), "alguna entrada tiene [VERIFICAR] o le faltan campos")
        self.assertEqual(len({e["id"] for e in todas}), len(todas), "ids repetidos")
        for vista in ("voluntario", "ong"):
            self.assertTrue(faq.entradas_faq(vista), vista)


class GroqTests(SinRed):
    HISTORIAL = [{"role": "user", "parts": [{"text": "hola"}]}]

    def _post_falso(self, cuerpo, enviado, status=200):
        def post(url, headers, json, timeout):
            enviado.update(json)
            enviado["_timeout"] = timeout
            return httpx.Response(status, text=cuerpo, request=httpx.Request("POST", url))
        return post

    @patch.dict(os.environ, {"GROQ_API_KEY": "falsa", "GROQ_MODEL": "modelo-falso"})
    def test_respuesta_buena_se_limpia_y_usa_el_modelo_del_env(self):
        enviado = {}
        cuerpo = json.dumps({"choices": [{"message": {"content": "Tocá **Mis participaciones**."}}]})
        with patch("chatbot.proveedor_groq.httpx.post", self._post_falso(cuerpo, enviado)):
            r = proveedor_groq.obtener_respuesta_groq(self.HISTORIAL, "PROMPT")
        self.assertEqual(r, "Tocá Mis participaciones.")
        self.assertEqual(enviado["model"], "modelo-falso")
        self.assertEqual(enviado["messages"][0], {"role": "system", "content": "PROMPT"})
        self.assertEqual(enviado["_timeout"], 10)

    @patch.dict(os.environ, {"GROQ_API_KEY": "falsa", "GROQ_MODEL": "modelo-falso"})
    def test_toda_falla_es_proveedor_error_y_nunca_un_texto(self):
        def sin_conexion(*args, **kwargs):
            raise httpx.ConnectError("sin red")

        casos = {
            "html en vez de json": self._post_falso("<html>502</html>", {}),
            "error http": self._post_falso("{}", {}, status=429),
            "sin choices": self._post_falso("{}", {}),
            "respuesta vacía": self._post_falso(json.dumps({"choices": [{"message": {"content": "  "}}]}), {}),
            "sin conexión": sin_conexion,
        }
        for nombre, post in casos.items():
            with patch("chatbot.proveedor_groq.httpx.post", post):
                with self.assertRaises(ProveedorError, msg=nombre):
                    proveedor_groq.obtener_respuesta_groq(self.HISTORIAL, "P")

    @patch.dict(os.environ, {"GROQ_API_KEY": "falsa", "GROQ_MODEL": "modelo-falso"})
    def test_modo_json_no_limpia_y_el_modo_normal_si(self):
        cuerpo = json.dumps({"choices": [{"message": {"content": '{"lugar": "**x**"}'}}]})
        with patch("chatbot.proveedor_groq.httpx.post", self._post_falso(cuerpo, {})):
            self.assertIn("**", proveedor_groq.obtener_respuesta_groq(self.HISTORIAL, "P", modo_json=True))
            self.assertNotIn("**", proveedor_groq.obtener_respuesta_groq(self.HISTORIAL, "P"))

    def test_sin_clave_o_sin_modelo_es_proveedor_error(self):
        for entorno in ({}, {"GROQ_API_KEY": "falsa"}, {"GROQ_MODEL": "m"}):
            with patch.dict(os.environ, entorno, clear=True):
                with self.assertRaises(ProveedorError):
                    proveedor_groq.obtener_respuesta_groq(self.HISTORIAL, "P")


class GeminiTests(SinRed):
    HISTORIAL = [{"role": "user", "parts": [{"text": "hola"}]}]

    def _cliente_falso(self, capturado, texto=None, error=None):
        class Modelos:
            def generate_content(self, model, contents, config):
                capturado["llamadas"] = capturado.get("llamadas", 0) + 1
                capturado.update(model=model, config=config)
                if error:
                    raise error
                return type("R", (), {"text": texto})()

        class Cliente:
            def __init__(self, **kw):
                capturado["init"] = kw
                self.models = Modelos()
        return Cliente

    @patch.dict(os.environ, {"GEMINI_API_KEY": "falsa"})
    def test_modelo_por_defecto_un_solo_intento_y_config_valida(self):
        os.environ.pop("GEMINI_MODEL", None)
        capturado = {}
        error_503 = genai_errors.APIError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})
        with patch("chatbot.proveedor.genai.Client", self._cliente_falso(capturado, error=error_503)):
            with self.assertRaises(ProveedorError):
                proveedor.obtener_respuesta_gemini(self.HISTORIAL, "P")
        self.assertEqual(capturado["llamadas"], 1)  # sin reintentos: la cadena pasa al siguiente proveedor
        self.assertEqual(capturado["model"], "gemini-3.5-flash-lite")
        self.assertEqual(capturado["init"]["http_options"]["timeout"], 20_000)
        config = types.GenerateContentConfig(**capturado["config"])  # tiene que pasar la validación real
        self.assertEqual(config.thinking_config.thinking_level, types.ThinkingLevel.LOW)

    @patch.dict(os.environ, {"GEMINI_API_KEY": "falsa", "GEMINI_MODEL": "otro-modelo"})
    def test_el_modelo_sale_del_env(self):
        capturado = {}
        with patch("chatbot.proveedor.genai.Client", self._cliente_falso(capturado, texto="Listo.")):
            proveedor.obtener_respuesta_gemini(self.HISTORIAL, "P")
        self.assertEqual(capturado["model"], "otro-modelo")

    @patch.dict(os.environ, {"GEMINI_API_KEY": "falsa"})
    def test_toda_falla_es_proveedor_error_y_nunca_un_texto(self):
        errores = {
            "429": genai_errors.APIError(429, {"error": {"code": 429, "message": "cuota", "status": "RESOURCE_EXHAUSTED"}}),
            "404": genai_errors.APIError(404, {"error": {"code": 404, "message": "modelo", "status": "NOT_FOUND"}}),
            "timeout": TimeoutError("lento"),
            "otro": RuntimeError("raro"),
        }
        for nombre, error in errores.items():
            with patch("chatbot.proveedor.genai.Client", self._cliente_falso({}, error=error)):
                with self.assertRaises(ProveedorError, msg=nombre):
                    proveedor.obtener_respuesta_gemini(self.HISTORIAL, "P")
        for vacio in (None, "", "   "):
            with patch("chatbot.proveedor.genai.Client", self._cliente_falso({}, texto=vacio)):
                with self.assertRaises(ProveedorError, msg=repr(vacio)):
                    proveedor.obtener_respuesta_gemini(self.HISTORIAL, "P")

    @patch.dict(os.environ, {"GEMINI_API_KEY": "falsa"})
    def test_modo_json_pide_json_y_no_recorta(self):
        capturado = {}
        crudo = '{"causa": null, "lugar": "Ciudad Autónoma de Buenos Aires"}'
        with patch("chatbot.proveedor.genai.Client", self._cliente_falso(capturado, texto=crudo)):
            r = proveedor.obtener_respuesta_gemini(self.HISTORIAL, "P", modo_json=True)
        self.assertEqual(r, crudo)  # sin el recorte a la última oración (un JSON no termina en punto)
        self.assertEqual(types.GenerateContentConfig(**capturado["config"]).response_mime_type, "application/json")

    def test_sin_clave_es_proveedor_error(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ProveedorError):
                proveedor.obtener_respuesta_gemini(self.HISTORIAL, "P")

    @patch.dict(os.environ, {"GEMINI_API_KEY": "falsa"})
    def test_limpia_markdown_y_recorta_la_oracion_incompleta(self):
        with patch("chatbot.proveedor.genai.Client", self._cliente_falso({}, texto="Tocá **Mapa**. Después abrí el det")):
            r = proveedor.obtener_respuesta_gemini(self.HISTORIAL, "P")
        self.assertEqual(r, "Tocá Mapa.")
