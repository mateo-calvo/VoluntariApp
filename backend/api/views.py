from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Administrador, Localidad, Ong, Provincia, Usuario, VistaConvocatoriasCards
from .serializers import (
    LocalidadSerializer,
    LoginSerializer,
    ProvinciaSerializer,
    RegistroOngSerializer,
    RegistroVoluntarioSerializer,
    VistaConvocatoriasCardsSerializer,
)
from .throttles import RegistroThrottle
import json
import os
import urllib.request
import urllib.error


MSG_EMAIL_EXISTE = "Ese email ya está registrado. Inicia sesión."


def primer_error(errores):
    """El front muestra un solo texto: tomamos el primer mensaje de los errores de DRF."""
    for mensajes in errores.values():
        if isinstance(mensajes, dict):
            return primer_error(mensajes)
        if mensajes:
            return str(mensajes[0])
    return "Datos inválidos."

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([RegistroThrottle])  # máx. 20 intentos por hora por IP (ver settings.py)
def register_voluntario(request):
    """Registro de voluntario creando la cuenta en Supabase Auth."""
    serializer = RegistroVoluntarioSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)

    vdata = serializer.validated_data
    supabase_url = os.getenv("SUPABASE_URL", "https://fzfiwitvjqlrqimxxcmt.supabase.co")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")

    payload = {
        "email": vdata["email"],
        "password": vdata["password"],
        "data": {
            "rol": "voluntario",
            "nombre": vdata["nombre"],
            "apellido": vdata["apellido"],
            "dni": vdata["dni"],
            "telefono": vdata["telefono"],
            "genero": vdata["genero"],
            "fecha_nacimiento": str(vdata["fecha_nacimiento"]),
            "provincia_id": vdata["provincia_id"],
            "localidad_id": vdata["localidad_id"],
            "direccion": vdata["direccion"],
        },
    }

    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/signup",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": anon_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            # Si Supabase devolvió identidades vacías, el email ya existía
            identities = resp_data.get("identities", [])
            if resp_data.get("id") and len(identities) == 0:
                return Response({"message": MSG_EMAIL_EXISTE}, status=status.HTTP_409_CONFLICT)
            return Response({"message": "Cuenta creada con éxito."}, status=status.HTTP_201_CREATED)

    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
            msg = err_body.get("msg") or err_body.get("message") or "Error al crear la cuenta."
            if "already registered" in msg.lower() or "unique constraint" in msg.lower():
                msg = "Ese correo o DNI ya se encuentra registrado."
            elif "rate limit" in msg.lower():
                msg = "Demasiados intentos recientes. Por favor, aguarda unos minutos e intenta de nuevo."
        except Exception:
            msg = "Error al comunicarse con el servicio de autenticación."
        return Response({"message": msg}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as err:
        return Response({"message": "Ocurrió un error inesperado al procesar el registro."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def listar_convocatorias(request):
    """Devuelve las convocatorias públicas consumiendo la vista de Supabase."""
    convocatorias = VistaConvocatoriasCards.objects.all()
    serializer = VistaConvocatoriasCardsSerializer(convocatorias, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def listar_provincias(request):
    """Devuelve el listado de provincias ordenadas alfabéticamente."""
    provincias = Provincia.objects.all()
    serializer = ProvinciaSerializer(provincias, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def listar_localidades(request):
    """Devuelve las localidades, opcionalmente filtradas por ?provincia_id=<id>."""
    provincia_id = request.query_params.get("provincia_id")
    qs = Localidad.objects.all()
    if provincia_id:
        qs = qs.filter(provincia_id=provincia_id)
    serializer = LocalidadSerializer(qs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    """Autentica al usuario contra Supabase Auth y detecta su rol (voluntario / admin)."""
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)

    vdata = serializer.validated_data
    email = vdata["email"]
    password = vdata["password"]

    supabase_url = os.getenv("SUPABASE_URL", "https://fzfiwitvjqlrqimxxcmt.supabase.co")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")

    payload = {"email": email, "password": password}
    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": anon_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            token = resp_data.get("access_token")
            user_info = resp_data.get("user", {})
            user_id = user_info.get("id")
            user_meta = user_info.get("user_metadata", {})

            # Determinamos el rol: si figura en administradores es admin, si no ong o voluntario
            es_admin = False
            try:
                es_admin = Administrador.objects.filter(id=user_id).exists()
            except Exception:
                pass

            ong_obj = None
            if not es_admin:
                try:
                    ong_obj = Ong.objects.filter(id=user_id).first()
                except Exception:
                    pass

            if es_admin:
                rol = "admin"
                nombre = f"{user_meta.get('nombre', '')} {user_meta.get('apellido', '')}".strip() or "Administrador"
            elif ong_obj or user_meta.get("rol") == "ong":
                rol = "ong"
                nombre = (ong_obj.nombre_organizacion if ong_obj else None) or user_meta.get("nombre_organizacion") or email.split("@")[0]
            else:
                rol = user_meta.get("rol", "voluntario")
                nombre = f"{user_meta.get('nombre', '')} {user_meta.get('apellido', '')}".strip() or email.split("@")[0]

            user_response = {
                "id": user_id,
                "email": email,
                "nombre": nombre,
                "rol": rol,
            }
            if rol == "ong" and ong_obj:
                user_response["ong_id"] = str(ong_obj.id)
                user_response["esta_verificada"] = ong_obj.esta_verificada
                user_response["cuit"] = ong_obj.cuit or ""

            return Response({
                "token": token,
                "user": user_response,
            }, status=status.HTTP_200_OK)

    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[LOGIN ERROR] Intento para '{email}': {err_body}")
        try:
            err_json = json.loads(err_body)
            desc = err_json.get("error_description") or err_json.get("msg") or ""
            if "email not confirmed" in desc.lower():
                return Response({"message": "El correo no ha sido confirmado en Supabase."}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            pass
        return Response({"message": "Credenciales incorrectas. Revisa tu email y contraseña."}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as err:
        print(f"[LOGIN ERROR INESPERADO] {err}")
        return Response({"message": "Error al procesar el inicio de sesión."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([RegistroThrottle])
def register_ong(request):
    """Registro de organización (ONG), creando la cuenta en Supabase Auth y en la tabla public.ongs."""
    serializer = RegistroOngSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)

    vdata = serializer.validated_data
    cuit = vdata["cuit"]
    email = vdata["email"]

    # Validación previa en base de datos para responder de inmediato sin llamadas externas
    if Ong.objects.filter(cuit=cuit).exists():
        return Response({"message": "Ya existe una organización registrada con ese CUIT."}, status=status.HTTP_409_CONFLICT)

    if Ong.objects.filter(email_contacto=email).exists() or Usuario.objects.filter(email=email).exists():
        return Response({"message": MSG_EMAIL_EXISTE}, status=status.HTTP_409_CONFLICT)

    supabase_url = os.getenv("SUPABASE_URL", "https://fzfiwitvjqlrqimxxcmt.supabase.co")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")

    payload = {
        "email": email,
        "password": vdata["password"],
        "data": {
            "rol": "ong",
            "nombre_organizacion": vdata["razon_social"],
            "cuit": cuit,
            "telefono": vdata.get("telefono") or "",
            "direccion": vdata["domicilio"],
        },
    }

    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/signup",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": anon_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            identities = resp_data.get("identities", [])
            user_id = resp_data.get("id")
            if user_id and len(identities) == 0:
                return Response({"message": MSG_EMAIL_EXISTE}, status=status.HTTP_409_CONFLICT)

            if not user_id:
                user_id = resp_data.get("user", {}).get("id")

            if user_id:
                try:
                    Ong.objects.update_or_create(
                        id=user_id,
                        defaults={
                            "nombre_organizacion": vdata["razon_social"],
                            "cuit": cuit,
                            "descripcion_institucional": vdata["descripcion"],
                            "provincia_id": vdata.get("provincia_id") or 1,
                            "localidad_id": vdata.get("localidad_id") or 1,
                            "direccion": vdata["domicilio"],
                            "telefono_contacto": vdata.get("telefono") or "",
                            "email_contacto": email,
                            "contacto": vdata["contacto"],
                            "sitio_web": vdata.get("web") or "",
                            "link_donacion": vdata.get("link_pago") or "",
                            "esta_verificada": False,
                        },
                    )
                except Exception as db_err:
                    print(f"[REGISTRO ONG DB ERROR] Error al guardar ONG en base de datos {user_id}: {db_err}")

            return Response(
                {"message": "Solicitud de registro enviada con éxito. Revisaremos tu documentación en 48 hs hábiles."},
                status=status.HTTP_201_CREATED,
            )

    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
            msg = err_body.get("msg") or err_body.get("message") or "Error al crear la cuenta de la organización."
            if "already registered" in msg.lower() or "unique constraint" in msg.lower():
                msg = MSG_EMAIL_EXISTE
            elif "rate limit" in msg.lower():
                msg = "Demasiados intentos recientes. Por favor, aguarda unos minutos e intenta de nuevo."
        except Exception:
            msg = "Error al comunicarse con el servicio de autenticación."
        return Response({"message": msg}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as err:
        print(f"[REGISTRO ONG ERROR INESPERADO] {err}")
        return Response({"message": "Ocurrió un error inesperado al procesar el registro."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
