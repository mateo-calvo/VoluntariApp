from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

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
