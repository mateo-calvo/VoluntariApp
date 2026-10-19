import uuid
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Usuario, VistaConvocatoriasCards


class HealthCheckTests(TestCase):
    """Verifica que el servicio esté activo y responda al monitor de salud."""

    def setUp(self):
        self.client = APIClient()

    def test_health_check_ok(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ok"})


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


class RegistroVoluntarioEndpointTests(TestCase):
    """Tests del endpoint público /api/auth/register-voluntario."""

    def setUp(self):
        self.client = APIClient()

    def test_registro_exitoso(self):
        data = {
            "nombre": "Carlos Gómez",
            "email": "carlos@voluntariado.org",
            "password": "PasswordSeguro123!",
        }
        response = self.client.post("/api/auth/register-voluntario", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json(), {"message": "Cuenta creada con éxito."})

        # Verifica que el usuario se haya persistido en la BD
        usuario = Usuario.objects.get(email="carlos@voluntariado.org")
        self.assertEqual(usuario.rol, Usuario.Rol.VOLUNTARIO)
        self.assertTrue(usuario.check_password("PasswordSeguro123!"))

    def test_registro_email_duplicado_devuelve_409(self):
        Usuario.objects.create_user(email="existente@mail.com", password="Password123!", nombre="Usuario Uno")

        data = {
            "nombre": "Usuario Dos",
            "email": "EXISTENTE@mail.com",  # con mayúsculas
            "password": "Password123!",
        }
        response = self.client.post("/api/auth/register-voluntario", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("ya está registrado", response.json().get("message", ""))

    def test_registro_password_corta_devuelve_400(self):
        data = {
            "nombre": "Ana",
            "email": "ana@mail.com",
            "password": "123",  # muy corta
        }
        response = self.client.post("/api/auth/register-voluntario", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_nombre_vacio_devuelve_400(self):
        data = {
            "nombre": "",
            "email": "ana@mail.com",
            "password": "PasswordSeguro123!",
        }
        response = self.client.post("/api/auth/register-voluntario", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ConvocatoriasEndpointTests(TestCase):
    """Tests del endpoint público /api/convocatorias/."""

    def setUp(self):
        self.client = APIClient()

    @patch("api.views.VistaConvocatoriasCards.objects.all")
    def test_listar_convocatorias_retorna_200_con_campos(self, mock_all):
        # Simulamos una convocatoria proveniente de la vista de Supabase
        mock_convocatoria = VistaConvocatoriasCards(
            convocatoria_id=uuid.uuid4(),
            titulo="Campaña de Donación de Sangre",
            descripcion="Ayudá en la jornada de salud comunitaria.",
            fecha="2026-11-15",
            hora="09:00:00",
            lugar="Plaza Flores",
            direccion="Av. Rivadavia 6900",
            latitud=-34.629,
            longitud=-58.459,
            cupos_disponibles=15,
            horas_estimadas=4,
            requiere_aprobacion=False,
            estado_convocatoria="abierta",
            ong_id=uuid.uuid4(),
            nombre_organizacion="Cruz Roja Argentina",
            ong_rating=4.9,
            ong_verificada=True,
            ong_logo_url="",
            ong_link_donacion="https://donar.cruzroja.org",
            causa_id=1,
            causa_nombre="Salud",
            localidad_id=1,
            localidad_nombre="Flores",
            provincia_id=1,
            provincia_nombre="Buenos Aires",
        )
        mock_all.return_value = [mock_convocatoria]

        response = self.client.get("/api/convocatorias/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)

        primera = data[0]
        self.assertEqual(primera["titulo"], "Campaña de Donación de Sangre")
        self.assertEqual(primera["nombre_organizacion"], "Cruz Roja Argentina")
        self.assertEqual(primera["cupos_disponibles"], 15)
        self.assertEqual(primera["causa_nombre"], "Salud")
        self.assertEqual(primera["localidad_nombre"], "Flores")

    @patch("api.views.VistaConvocatoriasCards.objects.all")
    def test_listar_convocatorias_vacia(self, mock_all):
        mock_all.return_value = []
        response = self.client.get("/api/convocatorias/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])
