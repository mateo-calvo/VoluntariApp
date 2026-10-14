from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase

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
