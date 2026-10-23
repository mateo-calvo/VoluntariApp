import json
import uuid
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework import status
from rest_framework.test import APIClient

from config.exceptions import mensaje_throttled

from .models import (
    Convocatoria,
    Localidad,
    Ong,
    Postulacion,
    Provincia,
    Usuario,
    VistaConvocatoriasCards,
    VistaConvocatoriasMapa,
    Voluntario,
)


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


class RegistroVoluntarioEndpointTests(TestCase):
    """Tests del endpoint público /api/auth/register-voluntario."""

    URL = "/api/auth/register-voluntario"

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.datos = {
            "nombre": "Ana",
            "apellido": "Pérez",
            "dni": "35123456",
            "telefono": "1144556677",
            "genero": "Femenino",
            "fecha_nacimiento": "1995-05-15",
            "provincia_id": 1,
            "localidad_id": 1,
            "direccion": "Av. Corrientes 1234",
            "email": "ana@mail.com",
            "password": "PasswordSeguro123!",
        }

    @patch("urllib.request.urlopen")
    def test_registro_exitoso(self, mock_urlopen):
        import io, json
        mock_resp = io.BytesIO(json.dumps({"id": "some-uuid", "identities": [{"id": "ident"}]}).encode("utf-8"))
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        response = self.client.post(self.URL, self.datos, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json(), {"message": "Cuenta creada con éxito."})

    @patch("urllib.request.urlopen")
    def test_registro_email_duplicado_devuelve_409(self, mock_urlopen):
        import io, json
        # Supabase devuelve identidades vacías si el email ya existe
        mock_resp = io.BytesIO(json.dumps({"id": "some-uuid", "identities": []}).encode("utf-8"))
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        response = self.client.post(self.URL, self.datos, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("ya está registrado", response.json().get("message", ""))

    def test_registro_password_corta_devuelve_400(self):
        data = {**self.datos, "password": "123"}
        response = self.client.post(self.URL, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_nombre_vacio_devuelve_400(self):
        data = {**self.datos, "nombre": ""}
        response = self.client.post(self.URL, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_genero_invalido_devuelve_400(self):
        data = {**self.datos, "genero": "Invalido"}
        response = self.client.post(self.URL, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_errores_400_con_message(self):
        casos = [
            {**self.datos, "nombre": " A "},
            {**self.datos, "email": "no-es-un-email"},
            {**self.datos, "dni": "12"},  # DNI muy corto
            {**self.datos, "telefono": "12"},  # Teléfono muy corto
            {**self.datos, "direccion": "ab"},  # Dirección muy corta
            {"email": "ana@mail.com", "password": "PasswordSeguro123!"},  # faltan campos
            {},
        ]
        for datos in casos:
            with self.subTest(datos=datos):
                res = self.client.post(self.URL, datos, format="json")
                self.assertEqual(res.status_code, 400)
                self.assertIsInstance(res.json()["message"], str)

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


class ConvocatoriasEndpointTests(TestCase):
    """Tests del endpoint público /api/convocatorias/."""

    def setUp(self):
        self.client = APIClient()

    @patch("api.views.VistaConvocatoriasMapa.objects.all")
    def test_listar_convocatorias_retorna_200_con_campos(self, mock_all):
        # Simulamos una convocatoria proveniente de la vista de Supabase
        mock_convocatoria = VistaConvocatoriasMapa(
            convocatoria_id=uuid.uuid4(),
            titulo="Campaña de Donación de Sangre",
            descripcion="Ayudá en la jornada de salud comunitaria.",
            fecha="2026-11-15",
            hora="09:00:00",
            lugar="Plaza Flores",
            direccion="Av. Rivadavia 6900",
            latitud=-34.629,
            longitud=-58.459,
            cupos_totales=15,
            inscriptos_actuales=3,
            lugares_libres=12,
            horas_estimadas=4,
            requiere_aprobacion=False,
            estado_convocatoria="ABIERTA",
            ong_id=uuid.uuid4(),
            nombre_organizacion="Cruz Roja Argentina",
            ong_rating=4.9,
            ong_verificada=True,
            ong_logo_url="",
            ong_link_donacion="https://donar.cruzroja.org",
            ong_email_contacto="contacto@cruzroja.org.ar",
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
        self.assertEqual(primera["cupos_totales"], 15)
        self.assertEqual(primera["lugares_libres"], 12)
        self.assertEqual(primera["inscriptos_actuales"], 3)
        self.assertEqual(primera["causa_nombre"], "Salud")
        self.assertEqual(primera["localidad_nombre"], "Flores")
        self.assertEqual(primera["ong_email_contacto"], "contacto@cruzroja.org.ar")

    @patch("api.views.VistaConvocatoriasMapa.objects.all")
    def test_listar_convocatorias_vacia(self, mock_all):
        mock_all.return_value = []
        response = self.client.get("/api/convocatorias/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])


class LoginEndpointTests(TestCase):
    """Tests del endpoint /api/auth/login."""

    URL = "/api/auth/login"

    def setUp(self):
        self.client = APIClient()

    def test_login_campos_faltantes_devuelve_400(self):
        res = self.client.post(self.URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("urllib.request.urlopen")
    def test_login_email_invalido_devuelve_400_sin_consultar_supabase(self, mock_urlopen):
        res = self.client.post(self.URL, {"email": "no-es-un-email", "password": "Password123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        mock_urlopen.assert_not_called()

    @patch("urllib.request.urlopen")
    def test_login_exitoso_voluntario(self, mock_urlopen):
        import io, json
        user_uuid = str(uuid.uuid4())
        mock_payload = {
            "access_token": "mock-token-xyz",
            "user": {
                "id": user_uuid,
                "email": "voluntario@test.com",
                "user_metadata": {
                    "rol": "voluntario",
                    "nombre": "Juan",
                    "apellido": "Pérez",
                },
            },
        }
        mock_resp = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        res = self.client.post(self.URL, {"email": "voluntario@test.com", "password": "Password123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["token"], "mock-token-xyz")
        self.assertEqual(data["user"]["rol"], "voluntario")
        self.assertEqual(data["user"]["nombre"], "Juan Pérez")

    @patch("urllib.request.urlopen")
    def test_login_credenciales_invalidas_devuelve_401(self, mock_urlopen):
        import urllib.error, io
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="http://supabase",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=io.BytesIO(b'{"error_code":"invalid_credentials"}')
        )
        res = self.client.post(self.URL, {"email": "err@test.com", "password": "wrong"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Credenciales incorrectas", res.json()["message"])

    @patch("urllib.request.urlopen")
    def test_login_exitoso_ong_usa_nombre_organizacion(self, mock_urlopen):
        import io, json
        user_uuid = str(uuid.uuid4())
        mock_payload = {
            "access_token": "mock-token-ong",
            "user": {
                "id": user_uuid,
                "email": "contacto@ong.org.ar",
                "user_metadata": {
                    "rol": "ong",
                    "nombre_organizacion": "Cruz Roja Argentina",
                },
            },
        }
        mock_resp = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        res = self.client.post(self.URL, {"email": "contacto@ong.org.ar", "password": "Password123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["user"]["rol"], "ong")
        self.assertEqual(data["user"]["nombre"], "Cruz Roja Argentina")

    @patch("api.views.Ong.objects.filter")
    @patch("urllib.request.urlopen")
    def test_login_exitoso_ong_resuelve_desde_tabla_ongs(self, mock_urlopen, mock_ong_filter):
        import io, json
        user_uuid = uuid.uuid4()
        mock_ong = MagicMock()
        mock_ong.id = user_uuid
        mock_ong.nombre_organizacion = "Cruz Roja Argentina"
        mock_ong.esta_verificada = True
        mock_ong.cuit = "30-12345678-9"
        mock_ong_filter.return_value.first.return_value = mock_ong

        mock_payload = {
            "access_token": "mock-token-ong-db",
            "user": {
                "id": str(user_uuid),
                "email": "contacto@cruzroja.org.ar",
                "user_metadata": {
                    "rol": "ong",
                },
            },
        }
        mock_resp = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        res = self.client.post(self.URL, {"email": "contacto@cruzroja.org.ar", "password": "Password123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["user"]["rol"], "ong")
        self.assertEqual(data["user"]["nombre"], "Cruz Roja Argentina")
        self.assertEqual(data["user"]["ong_id"], str(user_uuid))
        self.assertTrue(data["user"]["esta_verificada"])
        self.assertEqual(data["user"]["cuit"], "30-12345678-9")

    @patch("api.views.Administrador.objects.filter")
    @patch("urllib.request.urlopen")
    def test_login_exitoso_admin_detecta_rol_en_administradores(self, mock_urlopen, mock_admin_filter):
        import io, json
        user_uuid = str(uuid.uuid4())
        mock_admin_filter.return_value.exists.return_value = True

        mock_payload = {
            "access_token": "mock-token-admin",
            "user": {
                "id": user_uuid,
                "email": "admin@voluntariapp.org",
                "user_metadata": {
                    "nombre": "Admin",
                    "apellido": "General",
                },
            },
        }
        mock_resp = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        res = self.client.post(self.URL, {"email": "admin@voluntariapp.org", "password": "Password123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["user"]["rol"], "admin")

    @patch("urllib.request.urlopen")
    def test_login_email_no_confirmado_retorna_401_con_aviso(self, mock_urlopen):
        import urllib.error, io
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="http://supabase",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=io.BytesIO(b'{"error_description":"Email not confirmed"}')
        )
        res = self.client.post(self.URL, {"email": "sinconfirmar@test.com", "password": "Password123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("no ha sido confirmado", res.json()["message"])

    def test_login_metodo_get_no_permitido(self):
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    @patch("urllib.request.urlopen")
    def test_login_error_inesperado_devuelve_500(self, mock_urlopen):
        mock_urlopen.side_effect = Exception("Fallo de red inesperado con Supabase")
        res = self.client.post(self.URL, {"email": "error@test.com", "password": "Password123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(res.json(), {"message": "Error al procesar el inicio de sesión."})


class ProvinciasEndpointTests(TestCase):
    """Tests del endpoint público /api/provincias/."""

    URL = "/api/provincias/"

    def setUp(self):
        self.client = APIClient()

    @patch("api.views.Provincia.objects.all")
    def test_listar_provincias_retorna_200_con_datos(self, mock_all):
        p1 = Provincia(id=1, nombre="Buenos Aires")
        p2 = Provincia(id=2, nombre="Córdoba")
        mock_all.return_value = [p1, p2]

        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0], {"id": 1, "nombre": "Buenos Aires"})
        self.assertEqual(data[1], {"id": 2, "nombre": "Córdoba"})

    @patch("api.views.Provincia.objects.all")
    def test_listar_provincias_vacia(self, mock_all):
        mock_all.return_value = []
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), [])


class LocalidadesEndpointTests(TestCase):
    """Tests del endpoint público /api/localidades/."""

    URL = "/api/localidades/"

    def setUp(self):
        self.client = APIClient()

    @patch("api.views.Localidad.objects.all")
    def test_listar_localidades_sin_filtro(self, mock_all):
        l1 = Localidad(id=1, nombre="La Plata", provincia_id=1)
        l2 = Localidad(id=2, nombre="Quilmes", provincia_id=1)
        mock_all.return_value = [l1, l2]

        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["nombre"], "La Plata")
        self.assertEqual(data[0]["provincia_id"], 1)

    @patch("api.views.Localidad.objects.all")
    def test_listar_localidades_filtradas_por_provincia(self, mock_all):
        l1 = Localidad(id=10, nombre="Rosario", provincia_id=2)
        mock_qs = MagicMock()
        mock_qs.filter.return_value = [l1]
        mock_all.return_value = mock_qs

        res = self.client.get(f"{self.URL}?provincia_id=2")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mock_qs.filter.assert_called_once_with(provincia_id="2")
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["nombre"], "Rosario")
        self.assertEqual(data[0]["provincia_id"], 2)

    @patch("api.views.Localidad.objects.all")
    def test_listar_localidades_vacia(self, mock_all):
        mock_all.return_value = []
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), [])


class RegistroOngEndpointTests(TestCase):
    """Pruebas del endpoint /api/auth/register-ong."""

    URL = "/api/auth/register-ong"

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.valid_payload = {
            "razonSocial": "Fundación Huellas del Sur",
            "cuit": "30-12345678-9",
            "email": "contacto@huellasdelsur.org",
            "password": "ClaveSegura123!",
            "domicilio": "Av. Corrientes 1234",
            "descripcion": "Organización dedicada al rescate y adopción de animales.",
            "contacto": "María Gómez",
            "telefono": "1144332211",
            "web": "https://huellasdelsur.org",
            "linkPago": "https://donar.huellasdelsur.org",
            "provincia_id": 1,
            "localidad_id": 1,
        }

    def test_registro_ong_datos_faltantes_devuelve_400(self):
        """Si falta un campo obligatorio, devuelve 400 sin llamar a servicios externos."""
        payload = self.valid_payload.copy()
        payload.pop("razonSocial")
        res = self.client.post(self.URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", res.json())

    def test_registro_ong_cuit_invalido_devuelve_400(self):
        """Si el formato del CUIT es incorrecto, falla la validación con 400."""
        payload = self.valid_payload.copy()
        payload["cuit"] = "123456"
        res = self.client.post(self.URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("CUIT", res.json()["message"])

    def test_registro_ong_sin_provincia_devuelve_400(self):
        """Si no se especifica provincia, devuelve 400."""
        payload = self.valid_payload.copy()
        payload.pop("provincia_id")
        res = self.client.post(self.URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("provincia", res.json()["message"].lower())

    def test_registro_ong_sin_localidad_devuelve_400(self):
        """Si no se especifica localidad, devuelve 400."""
        payload = self.valid_payload.copy()
        payload.pop("localidad_id")
        res = self.client.post(self.URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("localidad", res.json()["message"].lower())

    @patch("api.views.Ong.objects.filter")
    def test_registro_ong_cuit_duplicado_devuelve_409(self, mock_ong_filter):
        """Si el CUIT ya existe registrado en la base de datos, devuelve 409."""
        mock_ong_filter.return_value.exists.return_value = True

        res = self.client.post(self.URL, self.valid_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("CUIT", res.json()["message"])
        mock_ong_filter.assert_called_with(cuit="30-12345678-9")

    @patch("api.views.Ong.objects.filter")
    def test_registro_ong_email_duplicado_devuelve_409(self, mock_ong_filter):
        """Si el email ya existe en Ong, devuelve 409."""
        # Primer llamado (cuit) -> False, segundo llamado (email) -> True
        mock_cuit_qs = MagicMock()
        mock_cuit_qs.exists.return_value = False
        mock_email_qs = MagicMock()
        mock_email_qs.exists.return_value = True
        mock_ong_filter.side_effect = [mock_cuit_qs, mock_email_qs]

        res = self.client.post(self.URL, self.valid_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("registrado", res.json()["message"].lower())

    @patch("api.views.Ong.objects.update_or_create")
    @patch("api.views.Ong.objects.filter")
    @patch("urllib.request.urlopen")
    def test_registro_ong_exitoso_crea_ong(self, mock_urlopen, mock_ong_filter, mock_update_or_create):
        """Un registro exitoso crea la cuenta en Supabase y la ONG en public.ongs."""
        mock_qs = MagicMock()
        mock_qs.exists.return_value = False
        mock_ong_filter.return_value = mock_qs

        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"id": "a0000000-0000-0000-0000-000000000001", "identities": [{"id": "1"}]}'
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        res = self.client.post(self.URL, self.valid_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("éxito", res.json()["message"])

        mock_update_or_create.assert_called_once()
        _, kwargs = mock_update_or_create.call_args
        self.assertEqual(kwargs["id"], "a0000000-0000-0000-0000-000000000001")
        self.assertEqual(kwargs["defaults"]["cuit"], "30-12345678-9")
        self.assertEqual(kwargs["defaults"]["nombre_organizacion"], "Fundación Huellas del Sur")
        self.assertFalse(kwargs["defaults"]["esta_verificada"])


class OngMiPerfilEndpointTests(TestCase):
    """Pruebas del endpoint /api/ong/mi-perfil."""

    URL = "/api/ong/mi-perfil"

    def setUp(self):
        self.client = APIClient()
        self.user_uuid = uuid.UUID("b0000000-0000-0000-0000-000000000001")

    def test_acceso_sin_token_devuelve_401(self):
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("urllib.request.urlopen")
    def test_acceso_rol_no_ong_devuelve_403(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "id": str(self.user_uuid),
            "user_metadata": {"rol": "voluntario"},
        }).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        res = self.client.get(self.URL, HTTP_AUTHORIZATION="Bearer token-voluntario")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    @patch("api.views.Ong.objects.filter")
    @patch("urllib.request.urlopen")
    def test_get_perfil_ong_exitoso(self, mock_urlopen, mock_ong_filter):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "id": str(self.user_uuid),
            "user_metadata": {"rol": "ong"},
        }).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        mock_ong = MagicMock()
        mock_ong.id = self.user_uuid
        mock_ong.nombre_organizacion = "Cruz Roja Argentina"
        mock_ong.cuit = "30-12345678-9"
        mock_ong.descripcion_institucional = "Organización humanitaria"
        mock_ong.provincia_id = 1
        mock_ong.localidad_id = 1
        mock_ong.provincia.nombre = "CABA"
        mock_ong.localidad.nombre = "Palermo"
        mock_ong.direccion = "Av. Las Heras 2214"
        mock_ong.telefono_contacto = "1144332211"
        mock_ong.email_contacto = "contacto@cruzroja.org.ar"
        mock_ong.contacto = "Juan Pérez"
        mock_ong.sitio_web = "https://cruzroja.org.ar"
        mock_ong.link_donacion = "https://donar.cruzroja.org.ar"
        mock_ong.logo_url = ""
        mock_ong.rating = 4.9
        mock_ong.esta_verificada = True
        mock_ong.created_at = "2026-10-20T00:00:00Z"

        mock_ong_filter.return_value.first.return_value = mock_ong

        res = self.client.get(self.URL, HTTP_AUTHORIZATION="Bearer token-ong-valido")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["nombre_organizacion"], "Cruz Roja Argentina")
        self.assertEqual(data["cuit"], "30-12345678-9")
        self.assertTrue(data["esta_verificada"])

    @patch("api.views.Ong.objects.filter")
    @patch("urllib.request.urlopen")
    def test_put_perfil_ong_actualiza_campos(self, mock_urlopen, mock_ong_filter):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "id": str(self.user_uuid),
            "user_metadata": {"rol": "ong"},
        }).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        mock_ong = MagicMock()
        mock_ong.id = self.user_uuid
        mock_ong.nombre_organizacion = "Nombre Anterior"
        mock_ong.cuit = "30-12345678-9"
        mock_ong.descripcion_institucional = "Descripción previa de prueba"
        mock_ong.provincia_id = 1
        mock_ong.localidad_id = 1
        mock_ong.provincia.nombre = "CABA"
        mock_ong.localidad.nombre = "Palermo"
        mock_ong.direccion = "Calle Vieja 100"
        mock_ong.telefono_contacto = ""
        mock_ong.email_contacto = "contacto@ong.org"
        mock_ong.contacto = "Referente"
        mock_ong.sitio_web = ""
        mock_ong.link_donacion = ""
        mock_ong.logo_url = ""
        mock_ong.rating = 5.0
        mock_ong.esta_verificada = False
        mock_ong.created_at = "2026-10-20T00:00:00Z"

        mock_ong_filter.return_value.first.return_value = mock_ong

        payload = {
            "nombre_organizacion": "Nombre Nuevo ONG",
            "descripcion_institucional": "Nueva descripción de al menos 10 caracteres.",
            "direccion": "Calle Nueva 200",
            "contacto": "Nuevo Referente",
        }
        res = self.client.put(self.URL, payload, format="json", HTTP_AUTHORIZATION="Bearer token-ong-valido")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("éxito", res.json()["message"])


class PostulacionEndpointTests(TestCase):
    """Tests para los endpoints de postulación y cancelación de voluntarios."""

    def setUp(self):
        self.client = APIClient()
        self.convocatoria_id = uuid.uuid4()
        self.voluntario_id = uuid.uuid4()

    @patch("api.views.obtener_usuario_desde_token")
    @patch("api.views.Voluntario.objects.filter")
    @patch("api.views.Convocatoria.objects.filter")
    @patch("api.views.Postulacion.objects.filter")
    @patch("api.views.Postulacion.objects.create")
    def test_postular_exitoso(self, mock_create, mock_postulacion_filter, mock_conv_filter, mock_vol_filter, mock_auth):
        mock_auth.return_value = ({
            "id": str(self.voluntario_id),
            "email": "voluntario@test.com",
            "user_metadata": {"rol": "voluntario", "nombre": "Juan", "apellido": "Pérez"}
        }, None)

        mock_voluntario = MagicMock()
        mock_voluntario.id = self.voluntario_id
        mock_vol_filter.return_value.first.return_value = mock_voluntario

        mock_convocatoria = MagicMock()
        mock_convocatoria.id = self.convocatoria_id
        mock_convocatoria.estado = "ABIERTA"
        mock_convocatoria.cupos_totales = 10
        mock_conv_filter.return_value.first.return_value = mock_convocatoria

        # No existe postulación previa y hay 2 inscriptos
        mock_postulacion_filter.return_value.first.return_value = None
        mock_postulacion_filter.return_value.count.return_value = 2

        mock_postulacion_creada = MagicMock()
        mock_postulacion_creada.id = uuid.uuid4()
        mock_postulacion_creada.convocatoria_id = self.convocatoria_id
        mock_postulacion_creada.estado = "POSTULADO"
        mock_postulacion_creada.convocatoria = mock_convocatoria
        mock_create.return_value = mock_postulacion_creada

        url = f"/api/convocatorias/{self.convocatoria_id}/participar"
        res = self.client.post(url, HTTP_AUTHORIZATION="Bearer token-voluntario")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data["inscriptos_actuales"], 3)
        self.assertEqual(data["lugares_libres"], 7)

    @patch("api.views.obtener_usuario_desde_token")
    @patch("api.views.Voluntario.objects.filter")
    @patch("api.views.Convocatoria.objects.filter")
    @patch("api.views.Postulacion.objects.filter")
    def test_postular_sin_cupos(self, mock_postulacion_filter, mock_conv_filter, mock_vol_filter, mock_auth):
        mock_auth.return_value = ({
            "id": str(self.voluntario_id),
            "email": "voluntario@test.com",
            "user_metadata": {"rol": "voluntario"}
        }, None)

        mock_vol_filter.return_value.first.return_value = MagicMock()

        mock_convocatoria = MagicMock()
        mock_convocatoria.estado = "ABIERTA"
        mock_convocatoria.cupos_totales = 5
        mock_conv_filter.return_value.first.return_value = mock_convocatoria

        mock_postulacion_filter.return_value.first.return_value = None
        mock_postulacion_filter.return_value.count.return_value = 5  # Cupos agotados

        url = f"/api/convocatorias/{self.convocatoria_id}/participar"
        res = self.client.post(url, HTTP_AUTHORIZATION="Bearer token-voluntario")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cupos", res.json()["message"])

    @patch("api.views.obtener_usuario_desde_token")
    @patch("api.views.Voluntario.objects.filter")
    @patch("api.views.Convocatoria.objects.filter")
    @patch("api.views.Postulacion.objects.filter")
    def test_postular_ya_inscripto(self, mock_postulacion_filter, mock_conv_filter, mock_vol_filter, mock_auth):
        mock_auth.return_value = ({
            "id": str(self.voluntario_id),
            "email": "voluntario@test.com",
            "user_metadata": {"rol": "voluntario"}
        }, None)

        mock_vol_filter.return_value.first.return_value = MagicMock()

        mock_convocatoria = MagicMock()
        mock_convocatoria.estado = "ABIERTA"
        mock_conv_filter.return_value.first.return_value = mock_convocatoria

        mock_existente = MagicMock()
        mock_existente.estado = "POSTULADO"
        mock_postulacion_filter.return_value.first.return_value = mock_existente

        url = f"/api/convocatorias/{self.convocatoria_id}/participar"
        res = self.client.post(url, HTTP_AUTHORIZATION="Bearer token-voluntario")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Ya estás postulado", res.json()["message"])

    @patch("api.views.obtener_usuario_desde_token")
    @patch("api.views.Voluntario.objects.filter")
    @patch("api.views.Convocatoria.objects.filter")
    @patch("api.views.Postulacion.objects.filter")
    def test_cancelar_postulacion_exitosa(self, mock_postulacion_filter, mock_conv_filter, mock_vol_filter, mock_auth):
        mock_auth.return_value = ({
            "id": str(self.voluntario_id),
            "email": "voluntario@test.com",
            "user_metadata": {"rol": "voluntario"}
        }, None)

        mock_vol_filter.return_value.first.return_value = MagicMock()

        mock_convocatoria = MagicMock()
        mock_convocatoria.cupos_totales = 10
        mock_conv_filter.return_value.first.return_value = mock_convocatoria

        mock_postulacion = MagicMock()
        mock_postulacion.estado = "POSTULADO"
        mock_postulacion_filter.return_value.first.return_value = mock_postulacion
        mock_postulacion_filter.return_value.count.return_value = 1  # Tras delete queda 1

        url = f"/api/convocatorias/{self.convocatoria_id}/cancelar-participacion"
        res = self.client.delete(url, HTTP_AUTHORIZATION="Bearer token-voluntario")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mock_postulacion.delete.assert_called_once()
        self.assertIn("cancelado", res.json()["message"])




