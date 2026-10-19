from django.conf import settings
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from config.exceptions import mensaje_throttled

from .models import Usuario


class EmailNormalizadoTests(TestCase):
    """El email se guarda siempre en minúsculas y sin espacios, venga de donde venga."""

    def test_create_user_normaliza_email(self):
        u = Usuario.objects.create_user(email="  Ana.Perez@MAIL.Com ", password="clave-segura-123", nombre="Ana")
        self.assertEqual(u.email, "ana.perez@mail.com")

    def test_save_normaliza_email_asignado_a_mano(self):
        u = Usuario.objects.create_user(email="ana@mail.com", password="clave-segura-123", nombre="Ana")
        u.email = " OTRO@Mail.COM "
        u.save()
        u.refresh_from_db()
        self.assertEqual(u.email, "otro@mail.com")

    def test_email_solo_espacios_es_invalido(self):
        with self.assertRaises(ValueError):
            Usuario.objects.create_user(email="   ", password="clave-segura-123", nombre="Ana")

    def test_full_clean_detecta_duplicado_con_otras_mayusculas(self):
        # Así valida el admin: tiene que dar error de validación, no un 500 de la base.
        Usuario.objects.create_user(email="ana@mail.com", password="clave-segura-123", nombre="Ana")
        dup = Usuario(email="ANA@Mail.com", nombre="Ana bis")
        dup.set_password("clave-segura-123")
        with self.assertRaises(ValidationError) as ctx:
            dup.full_clean()
        self.assertIn("email", ctx.exception.message_dict)

    def test_login_encuentra_usuario_con_otras_mayusculas(self):
        Usuario.objects.create_user(email="ana@mail.com", password="clave-segura-123", nombre="Ana")
        user = authenticate(email=" ANA@Mail.com", password="clave-segura-123")
        self.assertIsNotNone(user)
        self.assertEqual(user.email, "ana@mail.com")


class CreateSuperuserTests(TestCase):
    def test_createsuperuser_con_email(self):
        call_command(
            "createsuperuser",
            interactive=False,
            email="Admin@VoluntariApp.org",
            nombre="Admin",
            verbosity=0,
        )
        admin = Usuario.objects.get(email="admin@voluntariapp.org")
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_staff)
        self.assertEqual(admin.rol, Usuario.Rol.ADMIN)


class RegisterVoluntarioTests(TestCase):
    URL = "/api/auth/register-voluntario"

    def setUp(self):
        # El contador del throttling vive en la caché y sobrevive entre tests: lo reiniciamos.
        cache.clear()
        self.client = APIClient()
        self.datos = {"nombre": "Ana Pérez", "email": "Ana@Mail.com", "password": "girasol-azul-2026"}

    def post(self, datos):
        return self.client.post(self.URL, datos, format="json")

    def test_registro_ok_201(self):
        res = self.post(self.datos)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res["Content-Type"], "application/json")
        self.assertIn("message", res.json())
        u = Usuario.objects.get(email="ana@mail.com")
        self.assertEqual(u.nombre, "Ana Pérez")
        self.assertEqual(u.rol, Usuario.Rol.VOLUNTARIO)

    def test_password_hasheada_y_no_devuelta(self):
        res = self.post(self.datos)
        u = Usuario.objects.get(email="ana@mail.com")
        self.assertNotEqual(u.password, self.datos["password"])
        self.assertTrue(u.check_password(self.datos["password"]))
        self.assertNotIn("password", res.content.decode())
        self.assertNotIn(self.datos["password"], res.content.decode())

    def test_cliente_no_puede_elegir_rol(self):
        res = self.post({**self.datos, "rol": "admin", "is_staff": True, "is_superuser": True})
        self.assertEqual(res.status_code, 201)
        u = Usuario.objects.get(email="ana@mail.com")
        self.assertEqual(u.rol, Usuario.Rol.VOLUNTARIO)
        self.assertFalse(u.is_staff)
        self.assertFalse(u.is_superuser)

    def test_email_duplicado_409(self):
        self.post(self.datos)
        res = self.post({**self.datos, "email": "  ANA@mail.COM "})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()["message"], "Ese email ya está registrado. Inicia sesión.")
        self.assertEqual(Usuario.objects.count(), 1)

    def test_errores_400_con_message(self):
        casos = [
            {**self.datos, "nombre": " A "},
            {**self.datos, "email": "no-es-un-email"},
            {**self.datos, "password": "corta1"},
            {**self.datos, "password": "12345678"},
            {**self.datos, "password": "password"},
            {"email": "ana@mail.com", "password": "girasol-azul-2026"},  # falta nombre
            {},
        ]
        for datos in casos:
            with self.subTest(datos=datos):
                res = self.post(datos)
                self.assertEqual(res.status_code, 400)
                self.assertIsInstance(res.json()["message"], str)
        self.assertEqual(Usuario.objects.count(), 0)

    def test_json_malformado_responde_json(self):
        res = self.client.post(self.URL, "{esto no es json", content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res["Content-Type"], "application/json")
        self.assertIn("message", res.json())

    def test_get_no_permitido(self):
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, 405)
        self.assertEqual(res["Content-Type"], "application/json")
        self.assertIn("message", res.json())


class RegisterThrottlingTests(TestCase):
    """Límite de intentos por IP en el registro (frena la enumeración de emails)."""

    URL = "/api/auth/register-voluntario"
    # Se lee de settings ("20/hour" → 20) para que los tests sigan valiendo si cambia el límite.
    LIMITE = int(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["registro"].split("/")[0])

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def post(self, datos=None, **extra):
        # Datos vacíos → 400: gastan intentos sin crear usuarios.
        return self.client.post(self.URL, datos or {}, format="json", **extra)

    def agotar_limite(self, **extra):
        for _ in range(self.LIMITE):
            self.assertEqual(self.post(**extra).status_code, 400)

    def test_pasado_el_limite_responde_429_con_message(self):
        self.agotar_limite()
        res = self.post()
        self.assertEqual(res.status_code, 429)
        self.assertEqual(res["Content-Type"], "application/json")
        self.assertTrue(res.json()["message"].startswith("Demasiados intentos."))
        self.assertIn("Retry-After", res)

    def test_429_no_crea_usuario(self):
        self.agotar_limite()
        datos = {"nombre": "Ana Pérez", "email": "ana@mail.com", "password": "girasol-azul-2026"}
        res = self.post(datos)
        self.assertEqual(res.status_code, 429)
        self.assertFalse(Usuario.objects.exists())

    def test_429_no_revela_si_el_email_existe(self):
        Usuario.objects.create_user(email="ana@mail.com", password="girasol-azul-2026", nombre="Ana")
        self.agotar_limite()
        res = self.post({"nombre": "Ana", "email": "ana@mail.com", "password": "girasol-azul-2026"})
        self.assertEqual(res.status_code, 429)  # no 409: bloqueado no dice nada del email
        self.assertNotIn("registrado", res.json()["message"])

    def test_cambiar_x_forwarded_for_no_saltea_el_limite(self):
        # Un atacante manda una "IP" inventada distinta en cada pedido.
        for i in range(self.LIMITE):
            self.assertEqual(self.post(HTTP_X_FORWARDED_FOR=f"10.0.0.{i}").status_code, 400)
        res = self.post(HTTP_X_FORWARDED_FOR="10.0.0.250")
        self.assertEqual(res.status_code, 429)

    def test_el_limite_es_por_ip(self):
        self.agotar_limite(REMOTE_ADDR="192.168.0.10")
        self.assertEqual(self.post(REMOTE_ADDR="192.168.0.10").status_code, 429)
        self.assertEqual(self.post(REMOTE_ADDR="192.168.0.20").status_code, 400)


class MensajeThrottledTests(SimpleTestCase):
    def test_redondea_minutos_para_arriba(self):
        casos = {
            None: "Demasiados intentos. Intenta de nuevo más tarde.",
            0.4: "Demasiados intentos. Intenta de nuevo en 1 minuto.",
            60: "Demasiados intentos. Intenta de nuevo en 1 minuto.",
            61: "Demasiados intentos. Intenta de nuevo en 2 minutos.",
            3598: "Demasiados intentos. Intenta de nuevo en 60 minutos.",
        }
        for wait, esperado in casos.items():
            with self.subTest(wait=wait):
                self.assertEqual(mensaje_throttled(wait), esperado)
