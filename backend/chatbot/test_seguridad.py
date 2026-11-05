"""Etapa 5: seguridad del endpoint del chat, límites de uso y XSS en bot.js. Sin red."""
import json
import os
import re
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.test import Client, SimpleTestCase, TestCase, override_settings

from . import limites, views
from .test_ia import NO_ENTENDI_VOLUNTARIO, SIN_REGLA, con_ias, ia_falsa
from .utiles_test import BloqueaRed, SinRed, procesar

URL = "/api/chat/"
SIN_PROXIES = override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 0})


def entorno(**valores):
    return patch.dict(os.environ, {k: str(v) for k, v in valores.items()})


def enviar(cuerpo, ip="10.0.0.1", cliente=None, **cabeceras):
    """POST al chat con un cliente nuevo (sin cookies) desde la IP indicada."""
    if not isinstance(cuerpo, (str, bytes)):
        cuerpo = json.dumps(cuerpo)
    return (cliente or Client()).post(URL, cuerpo, content_type="application/json", REMOTE_ADDR=ip, **cabeceras)


def mensaje(texto="hola", **extra):
    return {"mensaje": texto, "vista": "voluntario", **extra}


class EndpointTests(BloqueaRed, TestCase):
    def test_cuerpos_invalidos_dan_400_nunca_500(self):
        cuerpos = [b"no es json", b"\xff\xfe\x00", "[1, 2]", '"texto"', "5", "null", "{}",
                   {"mensaje": 5}, {"mensaje": ["a"]}, {"mensaje": None}, {"mensaje": "   "}, {"vista": "ong"}]
        for i, cuerpo in enumerate(cuerpos):
            res = enviar(cuerpo, ip=f"10.1.0.{i}")
            self.assertEqual(res.status_code, 400, cuerpo)
            self.assertIn("error", res.json())

    def test_largo_maximo(self):
        with patch("chatbot.views.procesar_mensaje_usuario", lambda *a, **k: "ok"):
            self.assertEqual(enviar(mensaje("x" * views.LARGO_MAXIMO_MENSAJE), ip="10.2.0.1").status_code, 200)
            res = enviar(mensaje("x" * (views.LARGO_MAXIMO_MENSAJE + 1)), ip="10.2.0.2")
        self.assertEqual(res.status_code, 400)
        self.assertIn(str(views.LARGO_MAXIMO_MENSAJE), res.json()["error"])

    def test_vista_que_no_es_texto_se_toma_como_voluntario(self):
        vistas = []
        with patch("chatbot.views.procesar_mensaje_usuario", lambda h, vista, lat, lng: vistas.append(vista) or "ok"):
            for i, vista in enumerate((5, ["ong"], None, {"a": 1}, "ONG", "voluntario")):
                self.assertEqual(enviar({"mensaje": "hola", "vista": vista}, ip=f"10.3.0.{i}").status_code, 200, vista)
        self.assertEqual(vistas, ["voluntario", "voluntario", "voluntario", "voluntario", "ong", "voluntario"])

    def test_el_detalle_de_un_error_interno_no_se_muestra(self):
        for excepcion in (ValueError("clave-secreta-123"), RuntimeError("ruta C:\\secreto\\settings.py"), KeyError("tabla_privada")):
            def falla(*a, **k):
                raise excepcion

            with patch("chatbot.views.procesar_mensaje_usuario", falla), patch("traceback.print_exc"):
                res = enviar(mensaje(), ip="10.4.0.1")
            self.assertEqual(res.status_code, 500)
            self.assertEqual(res.json(), {"error": "Ocurrió un error al procesar tu solicitud."})
            for secreto in ("secreta", "secreto", "tabla_privada"):
                self.assertNotIn(secreto, res.content.decode())

    def test_ubicacion_valida_se_convierte_a_float(self):
        capturado = {}
        with patch("chatbot.views.procesar_mensaje_usuario", lambda h, v, lat, lng: capturado.update(lat=lat, lng=lng) or "ok"):
            enviar(mensaje(lat=-34, lng=-58.5), ip="10.5.0.1")
        self.assertEqual(capturado, {"lat": -34.0, "lng": -58.5})
        self.assertIsInstance(capturado["lat"], float)

    def test_ubicacion_invalida_se_ignora_entera(self):
        invalidos = [
            {"lat": True, "lng": 0}, {"lat": 0, "lng": False}, {"lat": "-34.6", "lng": "-58.4"}, {"lat": 91, "lng": 0},
            {"lat": 0, "lng": 181}, {"lat": -91, "lng": 0}, {"lat": [1], "lng": 0}, {"lat": None, "lng": None},
            {"lat": -34.6}, {"lng": -58.4}, {"lat": 10 ** 400, "lng": 0},
        ]
        crudos = ['{"mensaje": "hola", "lat": NaN, "lng": 0}', '{"mensaje": "hola", "lat": 0, "lng": Infinity}',
                  '{"mensaje": "hola", "lat": -Infinity, "lng": 0}']
        capturados = []
        with patch("chatbot.views.procesar_mensaje_usuario", lambda h, v, lat, lng: capturados.append((lat, lng)) or "ok"):
            for i, extra in enumerate(invalidos):
                self.assertEqual(enviar(mensaje(**extra), ip=f"10.6.0.{i}").status_code, 200, extra)
            for i, crudo in enumerate(crudos):
                self.assertEqual(enviar(crudo, ip=f"10.7.0.{i}").status_code, 200, crudo)
        self.assertEqual(capturados, [(None, None)] * (len(invalidos) + len(crudos)))

    def test_el_get_no_esta_permitido(self):
        self.assertEqual(Client().get(URL).status_code, 405)


@SIN_PROXIES
class LimitesTests(BloqueaRed, TestCase):
    def setUp(self):
        super().setUp()
        p = patch("chatbot.views.procesar_mensaje_usuario", lambda *a, **k: "ok")
        p.start()
        self.addCleanup(p.stop)

    def test_un_anonimo_sin_cookies_se_bloquea_por_ip(self):
        with entorno(CHAT_LIMITE_IP_MIN=3):
            codigos = [enviar(mensaje(), ip="20.0.0.1").status_code for _ in range(5)]  # un cliente nuevo cada vez
        self.assertEqual(codigos, [200, 200, 200, 429, 429])
        self.assertEqual(Session.objects.count(), 0)  # antes cada request creaba una sesión nueva y nunca había límite

    def test_el_mensaje_de_limite_es_claro(self):
        with entorno(CHAT_LIMITE_IP_MIN=1):
            enviar(mensaje(), ip="20.1.0.1")
            res = enviar(mensaje(), ip="20.1.0.1")
        self.assertEqual(res.status_code, 429)
        self.assertEqual(res.json(), {"error": limites.MSG_RAPIDO})

    def test_xff_falso_no_saltea_el_limite(self):
        with entorno(CHAT_LIMITE_IP_MIN=2):
            codigos = [enviar(mensaje(), ip="20.2.0.1", HTTP_X_FORWARDED_FOR=f"1.2.3.{i}").status_code for i in range(4)]
        self.assertEqual(codigos, [200, 200, 429, 429])

    def test_cada_ip_tiene_su_propio_contador(self):
        with entorno(CHAT_LIMITE_IP_MIN=1):
            self.assertEqual(enviar(mensaje(), ip="20.3.0.1").status_code, 200)
            self.assertEqual(enviar(mensaje(), ip="20.3.0.2").status_code, 200)
            self.assertEqual(enviar(mensaje(), ip="20.3.0.1").status_code, 429)

    def test_limite_diario_por_ip(self):
        with entorno(CHAT_LIMITE_IP_MIN=100, CHAT_LIMITE_IP_DIA=2):
            codigos = [enviar(mensaje(), ip="20.4.0.1").status_code for _ in range(3)]
            res = enviar(mensaje(), ip="20.4.0.1")
        self.assertEqual(codigos, [200, 200, 429])
        self.assertEqual(res.json(), {"error": limites.MSG_DIA})

    def test_un_usuario_con_sesion_se_cuenta_por_usuario_aunque_cambie_de_ip(self):
        valido = lambda request: ({"id": "usuario-1"}, None)
        with entorno(CHAT_LIMITE_USUARIO_MIN=2), patch("api.views.obtener_usuario_desde_token", valido):
            codigos = [enviar(mensaje(), ip=f"20.5.0.{i}", HTTP_AUTHORIZATION="Bearer token-bueno").status_code for i in range(4)]
        self.assertEqual(codigos, [200, 200, 429, 429])

    def test_cada_usuario_tiene_su_propio_contador(self):
        def segun_token(request):
            return {"id": request.headers["Authorization"].split()[-1]}, None

        with entorno(CHAT_LIMITE_USUARIO_MIN=1), patch("api.views.obtener_usuario_desde_token", segun_token):
            a1 = enviar(mensaje(), ip="20.6.0.1", HTTP_AUTHORIZATION="Bearer ana").status_code
            b1 = enviar(mensaje(), ip="20.6.0.2", HTTP_AUTHORIZATION="Bearer beto").status_code
            a2 = enviar(mensaje(), ip="20.6.0.3", HTTP_AUTHORIZATION="Bearer ana").status_code
        self.assertEqual((a1, b1, a2), (200, 200, 429))

    def test_token_invalido_es_anonimo_no_un_error(self):
        invalido = lambda request: (None, "Token inválido o expirado.")
        with entorno(CHAT_LIMITE_IP_MIN=2), patch("api.views.obtener_usuario_desde_token", invalido):
            codigos = [enviar(mensaje(), ip="20.7.0.1", HTTP_AUTHORIZATION="Bearer inventado").status_code for _ in range(3)]
        self.assertEqual(codigos, [200, 200, 429])  # solo cuenta la IP

    def test_si_la_validacion_del_token_explota_tambien_es_anonimo(self):
        def explota(request):
            raise RuntimeError("Supabase caído")

        with patch("api.views.obtener_usuario_desde_token", explota):
            self.assertEqual(enviar(mensaje(), ip="20.8.0.1", HTTP_AUTHORIZATION="Bearer x").status_code, 200)

    def test_la_ip_se_chequea_primero_y_no_se_consulta_a_supabase_si_ya_la_pasaron(self):
        consultas = []

        def valido(request):
            consultas.append(1)
            return {"id": "usuario-1"}, None

        with entorno(CHAT_LIMITE_IP_MIN=1), patch("api.views.obtener_usuario_desde_token", valido):
            for _ in range(5):
                enviar(mensaje(), ip="20.9.0.1", HTTP_AUTHORIZATION="Bearer inventado")
        self.assertEqual(len(consultas), 1)  # un token inventado repetido no genera consultas a Supabase

    def test_sin_authorization_no_se_consulta_a_supabase(self):
        def no_deberia(request):
            raise AssertionError("no hay token")

        with patch("api.views.obtener_usuario_desde_token", no_deberia):
            self.assertEqual(enviar(mensaje(), ip="20.10.0.1").status_code, 200)
            self.assertEqual(enviar(mensaje(), ip="20.10.0.1", HTTP_AUTHORIZATION="Basic abc").status_code, 200)

    def test_aviso_de_consultas_restantes(self):
        with entorno(CHAT_LIMITE_IP_MIN=100, CHAT_LIMITE_IP_DIA=3):
            respuestas = [enviar(mensaje(), ip="20.11.0.1").json()["respuesta"] for _ in range(3)]
        self.assertEqual(respuestas, ["ok (Te quedan 2 consultas por hoy).", "ok (Te quedan 1 consultas por hoy).",
                                      "ok (Esta fue tu última consulta disponible por hoy)."])

    def test_las_restantes_son_las_del_limite_que_mas_ajusta(self):
        valido = lambda request: ({"id": "usuario-1"}, None)
        with entorno(CHAT_LIMITE_USUARIO_DIA=2, CHAT_LIMITE_IP_DIA=300), patch("api.views.obtener_usuario_desde_token", valido):
            r = enviar(mensaje(), ip="20.12.0.1", HTTP_AUTHORIZATION="Bearer t").json()["respuesta"]
        self.assertEqual(r, "ok (Te quedan 1 consultas por hoy).")

    def test_valores_de_entorno_invalidos_usan_los_de_por_defecto(self):
        for invalido in ("abc", "", "-5", "1.5"):
            with entorno(CHAT_LIMITE_IP_MIN=invalido):
                self.assertEqual(limites.limite("CHAT_LIMITE_IP_MIN"), limites.POR_DEFECTO["CHAT_LIMITE_IP_MIN"], invalido)
        with entorno(CHAT_LIMITE_IP_MIN=7):
            self.assertEqual(limites.limite("CHAT_LIMITE_IP_MIN"), 7)

    def test_los_valores_por_defecto_son_realistas_y_no_los_10000_de_prueba(self):
        self.assertLessEqual(max(limites.POR_DEFECTO.values()), 300)


class TopeDeIaTests(SinRed):
    """El tope global de llamadas a la IA aplica solo a las llamadas a Groq/Gemini."""

    def test_al_llegar_al_tope_por_minuto_no_se_llama_a_la_ia_y_el_faq_y_las_reglas_siguen(self):
        llamadas = []
        with entorno(CHAT_IA_LIMITE_MIN=1, CHAT_IA_LIMITE_DIA=100), \
                con_ias(ia_falsa("Groq", falla=True, llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)):
            primero, log1 = procesar(SIN_REGLA)
            segundo, log2 = procesar(SIN_REGLA)
            faq_, _ = procesar("¿Es gratis?")
            cortesia, _ = procesar("hola")
        # Primer mensaje: Groq usó el único cupo y falló; Gemini ya no tuvo cupo
        self.assertEqual([l[0] for l in llamadas], ["Groq"])
        self.assertEqual((primero, segundo), (NO_ENTENDI_VOLUNTARIO, NO_ENTENDI_VOLUNTARIO))
        self.assertIn("Tope de llamadas a la IA alcanzado", log1 + log2)
        self.assertNotIn("No entendí", faq_)
        self.assertEqual(cortesia, "¡Hola! ¿En qué te puedo ayudar hoy con tus voluntariados?")

    def test_tope_diario(self):
        llamadas = []
        with entorno(CHAT_IA_LIMITE_MIN=100, CHAT_IA_LIMITE_DIA=2), con_ias(ia_falsa("Groq", "de la IA", llamadas=llamadas), ia_falsa("Gemini")):
            respuestas = [procesar(SIN_REGLA)[0] for _ in range(4)]
        self.assertEqual(respuestas, ["de la IA", "de la IA", NO_ENTENDI_VOLUNTARIO, NO_ENTENDI_VOLUNTARIO])
        self.assertEqual(len(llamadas), 2)

    def test_el_tope_por_minuto_no_gasta_el_cupo_del_dia(self):
        with entorno(CHAT_IA_LIMITE_MIN=1, CHAT_IA_LIMITE_DIA=5):
            resultados = [limites.reservar_llamada_ia() for _ in range(4)]
        self.assertEqual(resultados, [True, False, False, False])
        self.assertEqual(cache.get(f"chat_ia_dia_{limites._dia()}"), 1)

    def test_tambien_aplica_a_la_interpretacion_de_busquedas(self):
        llamadas = []
        with entorno(CHAT_IA_LIMITE_MIN=0), con_ias(ia_falsa("Groq", llamadas=llamadas), ia_falsa("Gemini", llamadas=llamadas)),                 patch("chatbot.servicio.responder_busqueda_por_reglas", lambda texto: "RESPUESTA DE LAS REGLAS"):
            r, log = procesar("convocatorias en Palermo")
        self.assertEqual(llamadas, [])
        self.assertEqual(r, "RESPUESTA DE LAS REGLAS")  # sin IA se busca por reglas
        self.assertIn("Tope de llamadas a la IA alcanzado", log)


class BotJsTests(SimpleTestCase):
    """Guardas estáticas: js/bot.js tiene que seguir mostrando los mensajes como texto."""

    @staticmethod
    def js():
        return (Path(settings.BASE_DIR).parent / "js" / "bot.js").read_text(encoding="utf-8")

    def test_los_mensajes_se_muestran_con_textcontent_no_con_innerhtml(self):
        js = self.js()
        self.assertIn("div.textContent = texto", js)
        # Ningún innerHTML puede interpolar el texto del mensaje, la hora ni la respuesta del servidor
        for asignacion in re.findall(r"\.innerHTML\s*=\s*`[^`]*`", js, flags=re.S):
            for variable in ("${texto}", "${hora}", "${data", "${respuesta"):
                self.assertNotIn(variable, asignacion, asignacion[:120])

    def test_manda_el_token_si_hay_sesion(self):
        js = self.js()
        self.assertIn("Authorization: `Bearer ${leerToken()}`", js)
        self.assertIn('sessionStorage.getItem("va_token")', js)

    def test_un_historial_corrupto_no_rompe_el_bot(self):
        js = self.js()
        self.assertGreaterEqual(js.count("JSON.parse(sessionStorage.getItem(claveSesion)"), 2)
        # cada JSON.parse del historial está dentro de un try
        for coincidencia in re.finditer(r"JSON\.parse\(sessionStorage\.getItem\(claveSesion\)", js):
            self.assertIn("try {", js[max(0, coincidencia.start() - 80):coincidencia.start()])
