from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import (
    Administrador,
    Causa,
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
from .serializers import (
    CausaSerializer,
    ConvocatoriaSerializer,
    LocalidadSerializer,
    LoginSerializer,
    OngPerfilSerializer,
    PostulacionSerializer,
    PostulanteOngSerializer,
    ProvinciaSerializer,
    RegistroOngSerializer,
    RegistroVoluntarioSerializer,
    VistaConvocatoriasCardsSerializer,
    VistaConvocatoriasMapaSerializer,
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
    """Devuelve las convocatorias públicas abiertas para el mapa consumiendo la vista de Supabase."""
    convocatorias = VistaConvocatoriasMapa.objects.all()
    serializer = VistaConvocatoriasMapaSerializer(convocatorias, many=True)
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


def obtener_usuario_desde_token(request):
    """Extrae el token Bearer del header Authorization y valida el usuario con Supabase Auth."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, "Falta el token de autorización (Bearer)."

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None, "Token de autorización vacío."

    supabase_url = os.getenv("SUPABASE_URL", "https://fzfiwitvjqlrqimxxcmt.supabase.co")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")

    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/user",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {token}",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            user_data = json.loads(resp.read().decode("utf-8"))
            return user_data, None
    except urllib.error.HTTPError:
        return None, "Token inválido o expirado."
    except Exception as err:
        print(f"[AUTH SUPABASE ERROR] {err}")
        return None, "Error de comunicación con el servicio de autenticación."


@api_view(["GET", "PUT"])
@authentication_classes([])
@permission_classes([AllowAny])
def ong_mi_perfil(request):
    """Permite a la ONG autenticada consultar (GET) y actualizar (PUT) su propia ficha pública."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    user_id = user_data.get("id")
    rol = user_data.get("user_metadata", {}).get("rol")
    if rol != "ong":
        return Response({"message": "Acceso restringido a organizaciones."}, status=status.HTTP_403_FORBIDDEN)

    user_email = user_data.get("email")
    try:
        ong = Ong.objects.filter(id=user_id).first()
        if not ong and user_email:
            ong = Ong.objects.filter(email_contacto__iexact=user_email).first()
    except Exception as db_err:
        print(f"[ONG MI PERFIL DB ERROR] {db_err}")
        ong = None

    if not ong:
        return Response({"message": "No se encontró la organización asociada a esta cuenta."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = OngPerfilSerializer(ong)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == "PUT":
        serializer = OngPerfilSerializer(ong, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({
            "message": "Ficha de la organización actualizada con éxito.",
            "data": serializer.data,
        }, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def listar_causas(request):
    """Devuelve el catálogo de causas / categorías de voluntariado."""
    causas = Causa.objects.all()
    serializer = CausaSerializer(causas, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def ong_mis_convocatorias(request):
    """Permite a la ONG autenticada listar (GET) y crear (POST) sus convocatorias."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    rol = user_data.get("user_metadata", {}).get("rol")
    if rol != "ong":
        return Response({"message": "Acceso restringido a organizaciones."}, status=status.HTTP_403_FORBIDDEN)

    user_id = user_data.get("id")
    user_email = user_data.get("email")
    ong = Ong.objects.filter(id=user_id).first()
    if not ong and user_email:
        ong = Ong.objects.filter(email_contacto__iexact=user_email).first()

    if not ong:
        return Response({"message": "No se encontró la organización asociada a esta cuenta."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        convocatorias = Convocatoria.objects.filter(ong=ong)
        estado_filtro = request.GET.get("estado")
        if estado_filtro and estado_filtro.upper() != "TODAS":
            convocatorias = convocatorias.filter(estado__iexact=estado_filtro)
        serializer = ConvocatoriaSerializer(convocatorias, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == "POST":
        serializer = ConvocatoriaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            convocatoria = serializer.save(ong=ong)
            return Response({
                "message": "Convocatoria publicada con éxito.",
                "data": ConvocatoriaSerializer(convocatoria).data,
            }, status=status.HTTP_201_CREATED)
        except Exception as db_err:
            print(f"[CONVOCATORIA POST ERROR] {db_err}")
            return Response({"message": f"Error al guardar en la base de datos: {db_err}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "DELETE"])
@authentication_classes([])
@permission_classes([AllowAny])
def ong_detalle_convocatoria(request, convocatoria_id):
    """Permite consultar, editar o pausar/cerrar una convocatoria específica de la ONG."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    rol = user_data.get("user_metadata", {}).get("rol")
    if rol != "ong":
        return Response({"message": "Acceso restringido a organizaciones."}, status=status.HTTP_403_FORBIDDEN)

    user_id = user_data.get("id")
    user_email = user_data.get("email")
    ong = Ong.objects.filter(id=user_id).first()
    if not ong and user_email:
        ong = Ong.objects.filter(email_contacto__iexact=user_email).first()

    if not ong:
        return Response({"message": "No se encontró la organización asociada."}, status=status.HTTP_404_NOT_FOUND)

    convocatoria = Convocatoria.objects.filter(id=convocatoria_id, ong=ong).first()
    if not convocatoria:
        return Response({"message": "Convocatoria no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = ConvocatoriaSerializer(convocatoria)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == "PUT":
        if convocatoria.estado in ["CANCELADA", "FINALIZADA"]:
            estado_texto = "cancelada" if convocatoria.estado == "CANCELADA" else "finalizada"
            return Response(
                {"message": f"Esta convocatoria ya se encuentra {estado_texto} y no puede ser modificada ni volver a cambiar de estado."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ConvocatoriaSerializer(convocatoria, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            serializer.save()
            return Response({
                "message": "Convocatoria actualizada con éxito.",
                "data": serializer.data,
            }, status=status.HTTP_200_OK)
        except Exception as db_err:
            print(f"[CONVOCATORIA PUT ERROR] {db_err}")
            return Response({"message": f"Error al actualizar en la base de datos: {db_err}"}, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == "DELETE":
        if convocatoria.estado in ["CANCELADA", "FINALIZADA"]:
            estado_texto = "cancelada" if convocatoria.estado == "CANCELADA" else "finalizada"
            return Response(
                {"message": f"La convocatoria ya se encuentra {estado_texto}."},
                status=status.HTTP_400_BAD_REQUEST
            )
        convocatoria.estado = "CANCELADA"
        convocatoria.save()
        return Response({"message": "Convocatoria cancelada/cerrada con éxito."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def ong_convocatoria_postulaciones(request, convocatoria_id):
    """Permite a la ONG consultar los voluntarios postulados a una de sus convocatorias."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    rol = user_data.get("user_metadata", {}).get("rol")
    if rol != "ong":
        return Response({"message": "Acceso restringido a organizaciones."}, status=status.HTTP_403_FORBIDDEN)

    user_id = user_data.get("id")
    user_email = user_data.get("email")
    ong = Ong.objects.filter(id=user_id).first()
    if not ong and user_email:
        ong = Ong.objects.filter(email_contacto__iexact=user_email).first()

    if not ong:
        return Response({"message": "No se encontró la organización asociada."}, status=status.HTTP_404_NOT_FOUND)

    convocatoria = Convocatoria.objects.filter(id=convocatoria_id, ong=ong).first()
    if not convocatoria:
        return Response({"message": "Convocatoria no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    postulaciones = Postulacion.objects.filter(convocatoria=convocatoria).select_related("voluntario").order_by("-created_at")
    estado_filtro = request.GET.get("estado")
    if estado_filtro and estado_filtro.upper() != "TODAS":
        postulaciones = postulaciones.filter(estado__iexact=estado_filtro)

    serializer = PostulanteOngSerializer(postulaciones, many=True)
    return Response({
        "convocatoria_id": str(convocatoria.id),
        "titulo": convocatoria.titulo,
        "cupos_totales": convocatoria.cupos_totales,
        "postulaciones": serializer.data,
    }, status=status.HTTP_200_OK)


@api_view(["PATCH", "PUT"])
@authentication_classes([])
@permission_classes([AllowAny])
def ong_actualizar_postulacion(request, postulacion_id):
    """Permite a la ONG cambiar el estado de un postulante (CONFIRMADO, ASISTIO, CANCELADO)."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    rol = user_data.get("user_metadata", {}).get("rol")
    if rol != "ong":
        return Response({"message": "Acceso restringido a organizaciones."}, status=status.HTTP_403_FORBIDDEN)

    user_id = user_data.get("id")
    user_email = user_data.get("email")
    ong = Ong.objects.filter(id=user_id).first()
    if not ong and user_email:
        ong = Ong.objects.filter(email_contacto__iexact=user_email).first()

    if not ong:
        return Response({"message": "No se encontró la organización asociada."}, status=status.HTTP_404_NOT_FOUND)

    postulacion = Postulacion.objects.filter(id=postulacion_id, convocatoria__ong=ong).select_related("convocatoria", "voluntario").first()
    if not postulacion:
        return Response({"message": "Postulación no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    # Validar si ya está en estado terminal
    if postulacion.estado == "CANCELADO":
        return Response(
            {"message": "La postulación fue cancelada y no puede volver a modificarse."},
            status=status.HTTP_400_BAD_REQUEST
        )
    if postulacion.estado == "ASISTIO":
        return Response(
            {"message": "La postulación ya fue finalizada (asistió) y no puede volver a modificarse."},
            status=status.HTTP_400_BAD_REQUEST
        )

    nuevo_estado = request.data.get("estado", "").strip().upper()
    if nuevo_estado not in ["CONFIRMADO", "ASISTIO", "CANCELADO"]:
        return Response(
            {"message": "Estado no válido. Las opciones permitidas son: CONFIRMADO, ASISTIO o CANCELADO."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Si se confirma, validar que no exceda cupos
    if nuevo_estado == "CONFIRMADO" and postulacion.estado != "CONFIRMADO":
        inscriptos = Postulacion.objects.filter(
            convocatoria=postulacion.convocatoria,
            estado__in=["POSTULADO", "CONFIRMADO"]
        ).exclude(id=postulacion.id).count()

        if inscriptos + 1 > postulacion.convocatoria.cupos_totales:
            return Response(
                {"message": "No quedan cupos disponibles para confirmar más voluntarios."},
                status=status.HTTP_400_BAD_REQUEST
            )

    postulacion.estado = nuevo_estado
    postulacion.save()

    inscriptos_actuales = Postulacion.objects.filter(
        convocatoria=postulacion.convocatoria,
        estado__in=["POSTULADO", "CONFIRMADO"]
    ).count()
    libres = max(0, postulacion.convocatoria.cupos_totales - inscriptos_actuales)

    return Response({
        "message": f"Postulación actualizada a {nuevo_estado}.",
        "postulacion": PostulanteOngSerializer(postulacion).data,
        "inscriptos_actuales": inscriptos_actuales,
        "lugares_libres": libres,
    }, status=status.HTTP_200_OK)


@api_view(["POST", "DELETE"])
@authentication_classes([])
@permission_classes([AllowAny])
def postular_convocatoria(request, id):
    """Permite a un voluntario autenticado postularse o cancelar su postulación a una convocatoria."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    rol = user_data.get("user_metadata", {}).get("rol")
    if rol != "voluntario":
        return Response({"message": "Acceso restringido a voluntarios."}, status=status.HTTP_403_FORBIDDEN)

    user_id = user_data.get("id")
    user_email = user_data.get("email")

    voluntario = Voluntario.objects.filter(id=user_id).first()
    if not voluntario and user_email:
        voluntario = Voluntario.objects.filter(email__iexact=user_email).first()

    if not voluntario and request.method == "POST":
        voluntario = Voluntario.objects.create(
            id=user_id,
            nombre=user_data.get("user_metadata", {}).get("nombre", "Voluntario"),
            apellido=user_data.get("user_metadata", {}).get("apellido", ""),
            email=user_email,
        )

    convocatoria = Convocatoria.objects.filter(id=id).first()
    if not convocatoria:
        return Response({"message": "Convocatoria no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        if not voluntario:
            return Response({"message": "No tenés una postulación en esta convocatoria."}, status=status.HTTP_400_BAD_REQUEST)

        postulacion = Postulacion.objects.filter(
            convocatoria=convocatoria,
            voluntario=voluntario,
            estado__in=["POSTULADO", "CONFIRMADO"]
        ).first()

        if not postulacion:
            return Response({"message": "No tenés una postulación activa en esta convocatoria."}, status=status.HTTP_400_BAD_REQUEST)

        postulacion.estado = "CANCELADO"
        postulacion.save()

        inscriptos = Postulacion.objects.filter(convocatoria=convocatoria, estado__in=["POSTULADO", "CONFIRMADO"]).count()
        libres = max(0, convocatoria.cupos_totales - inscriptos)

        return Response({
            "message": "Participación cancelada con éxito. El cupo vuelve a estar disponible.",
            "inscriptos_actuales": inscriptos,
            "lugares_libres": libres,
        }, status=status.HTTP_200_OK)

    # Flujo POST
    if convocatoria.estado != "ABIERTA":
        return Response({"message": "La convocatoria no está abierta para nuevas postulaciones."}, status=status.HTTP_400_BAD_REQUEST)

    # Validar si ya existe una postulación
    postulacion_existente = Postulacion.objects.filter(convocatoria=convocatoria, voluntario=voluntario).first()
    if postulacion_existente:
        if postulacion_existente.estado in ["POSTULADO", "CONFIRMADO"]:
            return Response({"message": "Ya estás postulado a esta convocatoria."}, status=status.HTTP_400_BAD_REQUEST)
        if postulacion_existente.estado == "CANCELADO":
            return Response({"message": "Tu postulación a esta convocatoria fue cancelada y no puede volver a abrirse."}, status=status.HTTP_400_BAD_REQUEST)
        if postulacion_existente.estado in ["ASISTIO", "FINALIZADO"]:
            return Response({"message": "Esta postulación ya se encuentra finalizada."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Ya tenés un registro en esta convocatoria."}, status=status.HTTP_400_BAD_REQUEST)

    # Validar cupos
    inscriptos = Postulacion.objects.filter(convocatoria=convocatoria, estado__in=["POSTULADO", "CONFIRMADO"]).count()
    if inscriptos >= convocatoria.cupos_totales:
        return Response({"message": "No quedan cupos disponibles para esta convocatoria."}, status=status.HTTP_400_BAD_REQUEST)

    # Determinar estado inicial y mensaje según requiere_aprobacion
    if convocatoria.requiere_aprobacion:
        estado_inicial = "POSTULADO"
        mensaje_exito = "¡Te postulaste con éxito! Tu postulación quedó pendiente de aprobación por parte de la organización."
    else:
        estado_inicial = "CONFIRMADO"
        mensaje_exito = "¡Te postulaste con éxito! Tu participación está confirmada."

    postulacion = Postulacion.objects.create(
        convocatoria=convocatoria,
        voluntario=voluntario,
        estado=estado_inicial,
    )

    nuevo_inscriptos = inscriptos + 1
    libres = max(0, convocatoria.cupos_totales - nuevo_inscriptos)

    return Response({
        "message": mensaje_exito,
        "postulacion": PostulacionSerializer(postulacion).data,
        "inscriptos_actuales": nuevo_inscriptos,
        "lugares_libres": libres,
    }, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def mis_postulaciones(request):
    """
    Devuelve las postulaciones del voluntario autenticado.
    Filtro opcional por query param ?estado=:
      - ?estado=activas: devuelve POSTULADO y CONFIRMADO.
      - ?estado=<nombre_estado>: filtra por ese estado (ej: confirmado, cancelado).
      - Sin param o ?estado=todas: devuelve todas las postulaciones.
    """
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    rol = user_data.get("user_metadata", {}).get("rol")
    if rol != "voluntario":
        return Response({"message": "Acceso restringido a voluntarios."}, status=status.HTTP_403_FORBIDDEN)

    user_id = user_data.get("id")
    user_email = user_data.get("email")

    voluntario = Voluntario.objects.filter(id=user_id).first()
    if not voluntario and user_email:
        voluntario = Voluntario.objects.filter(email__iexact=user_email).first()

    if not voluntario:
        return Response([], status=status.HTTP_200_OK)

    postulaciones = Postulacion.objects.filter(voluntario=voluntario).select_related(
        "convocatoria", "convocatoria__ong"
    )

    estado_param = request.query_params.get("estado", "").strip().lower()
    if estado_param == "activas":
        postulaciones = postulaciones.filter(estado__in=["POSTULADO", "CONFIRMADO"])
    elif estado_param and estado_param != "todas":
        postulaciones = postulaciones.filter(estado__iexact=estado_param)

    postulaciones = postulaciones.order_by("-created_at")
    serializer = PostulacionSerializer(postulaciones, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


def es_usuario_admin(user_id):
    """Verifica si el user_id corresponde a un Administrador en Supabase."""
    if not user_id:
        return False
    return Administrador.objects.filter(id=user_id).exists()


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_dashboard(request):
    """
    Retorna datos consolidados para el panel de administración:
    - Métricas globales (pendientes, verificadas, usuarios, participaciones)
    - Listado de ONGs con datos y estado de verificación
    - Listado de usuarios registrados con su rol
    """
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    user_id = user_data.get("id")
    if not es_usuario_admin(user_id):
        return Response({"message": "Acceso restringido a administradores."}, status=status.HTTP_403_FORBIDDEN)

    ongs_qs = Ong.objects.select_related("provincia", "localidad").order_by("-created_at")
    ongs_data = []
    pendientes_count = 0
    verificadas_count = 0

    for o in ongs_qs:
        verificada = bool(o.esta_verificada)
        if verificada:
            verificadas_count += 1
        else:
            pendientes_count += 1

        ubicacion = ""
        if o.localidad and o.provincia:
            ubicacion = f"{o.localidad.nombre}, {o.provincia.nombre}"
        elif o.provincia:
            ubicacion = o.provincia.nombre
        elif o.direccion:
            ubicacion = o.direccion

        ongs_data.append({
            "id": str(o.id),
            "razonSocial": o.nombre_organizacion,
            "nombrePublico": o.nombre_organizacion,
            "cuit": o.cuit or "",
            "email": o.email_contacto or "",
            "barrio": ubicacion,
            "direccion": o.direccion or "",
            "descripcion": o.descripcion_institucional or "",
            "web": o.sitio_web or "",
            "contacto": o.contacto or o.telefono_contacto or "",
            "verificada": verificada,
            "estado": "verificada" if verificada else "pendiente",
        })

    try:
        total_parts = Postulacion.objects.count()
    except Exception:
        total_parts = 0

    # Convocatorias
    convocatorias_qs = Convocatoria.objects.select_related("ong", "causa", "provincia", "localidad").order_by("-created_at")
    convocatorias_data = []

    for c in convocatorias_qs:
        postulaciones_count = Postulacion.objects.filter(convocatoria=c).count()
        confirmados_count = Postulacion.objects.filter(convocatoria=c, estado__in=["POSTULADO", "CONFIRMADO"]).count()
        cupos_libres = max(0, c.cupos_totales - confirmados_count)

        ubicacion = ""
        if c.localidad and c.provincia:
            ubicacion = f"{c.localidad.nombre}, {c.provincia.nombre}"
        elif c.provincia:
            ubicacion = c.provincia.nombre
        elif c.direccion:
            ubicacion = c.direccion

        convocatorias_data.append({
            "id": str(c.id),
            "titulo": c.titulo,
            "descripcion": c.descripcion or "",
            "ong_nombre": c.ong.nombre_organizacion if c.ong else "Organización",
            "ong_id": str(c.ong.id) if c.ong else "",
            "causa": c.causa.nombre if c.causa else "General",
            "estado": c.estado or "ABIERTA",
            "fecha": str(c.fecha) if c.fecha else "",
            "hora": str(c.hora) if c.hora else "",
            "ubicacion": ubicacion,
            "direccion": c.direccion or "",
            "lugar": c.lugar or "",
            "cupos_totales": c.cupos_totales,
            "cupos_disponibles": cupos_libres,
            "total_postulantes": postulaciones_count,
            "horas_estimadas": c.horas_estimadas,
        })

    usuarios_data = []
    try:
        for v in Voluntario.objects.all():
            usuarios_data.append({
                "nombre": f"{v.nombre} {v.apellido}".strip(),
                "email": v.email or "",
                "rol": "voluntario",
            })
    except Exception:
        pass

    for o in ongs_qs:
        usuarios_data.append({
            "nombre": o.nombre_organizacion,
            "email": o.email_contacto or "",
            "rol": "ong",
        })

    try:
        for a in Administrador.objects.all():
            usuarios_data.append({
                "nombre": f"{a.nombre} {a.apellido}".strip() or "Administrador",
                "email": user_data.get("email") if str(a.id) == str(user_id) else "admin@voluntariapp.org",
                "rol": "admin",
            })
    except Exception:
        pass

    metricas = {
        "pendientes": pendientes_count,
        "verificadas": verificadas_count,
        "usuarios": len(usuarios_data),
        "convocatorias": len(convocatorias_data),
        "participaciones": total_parts,
    }

    return Response({
        "metricas": metricas,
        "ongs": ongs_data,
        "convocatorias": convocatorias_data,
        "usuarios": usuarios_data,
    }, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_verificar_ong(request, ong_id):
    """
    Permite al administrador cambiar el estado de verificación de una ONG.
    Body: {"esta_verificada": true/false} o {"accion": "aceptar"|"revocar"}
    """
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    user_id = user_data.get("id")
    if not es_usuario_admin(user_id):
        return Response({"message": "Acceso restringido a administradores."}, status=status.HTTP_403_FORBIDDEN)

    ong = Ong.objects.filter(id=ong_id).first()
    if not ong:
        return Response({"message": "Organización no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    nuevo_estado = request.data.get("esta_verificada")
    if nuevo_estado is None:
        accion = request.data.get("accion", "").strip().lower()
        if accion == "aceptar":
            nuevo_estado = True
        elif accion in ["revocar", "rechazar"]:
            nuevo_estado = False

    if nuevo_estado is None:
        return Response(
            {"message": "Debe especificar 'esta_verificada' (booleano) o 'accion'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ong.esta_verificada = bool(nuevo_estado)
    ong.save(update_fields=["esta_verificada"])

    msg = "ONG aceptada. Ya figura verificada en el mapa." if ong.esta_verificada else "Verificación de ONG revocada."
    return Response({
        "message": msg,
        "id": str(ong.id),
        "esta_verificada": ong.esta_verificada,
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_convocatoria_postulaciones(request, convocatoria_id):
    """Retorna todos los postulantes de una convocatoria para el panel de administración."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    user_id = user_data.get("id")
    if not es_usuario_admin(user_id):
        return Response({"message": "Acceso restringido a administradores."}, status=status.HTTP_403_FORBIDDEN)

    convocatoria = Convocatoria.objects.filter(id=convocatoria_id).select_related("ong", "causa", "provincia", "localidad").first()
    if not convocatoria:
        return Response({"message": "Convocatoria no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    postulaciones = Postulacion.objects.filter(convocatoria=convocatoria).select_related("voluntario").order_by("-created_at")

    postulantes_data = []
    for p in postulaciones:
        vol = p.voluntario
        postulantes_data.append({
            "id": str(p.id),
            "nombre": f"{vol.nombre} {vol.apellido}".strip() if vol else "Voluntario",
            "email": vol.email if vol else "",
            "telefono": vol.telefono if vol else "",
            "dni": vol.dni if vol else "",
            "estado": p.estado,
            "created_at": p.created_at.strftime("%d/%m/%Y %H:%M") if p.created_at else "",
        })

    ubicacion = ""
    if convocatoria.localidad and convocatoria.provincia:
        ubicacion = f"{convocatoria.localidad.nombre}, {convocatoria.provincia.nombre}"
    elif convocatoria.provincia:
        ubicacion = convocatoria.provincia.nombre
    elif convocatoria.direccion:
        ubicacion = convocatoria.direccion

    return Response({
        "convocatoria": {
            "id": str(convocatoria.id),
            "titulo": convocatoria.titulo,
            "descripcion": convocatoria.descripcion or "",
            "ong_nombre": convocatoria.ong.nombre_organizacion if convocatoria.ong else "",
            "causa": convocatoria.causa.nombre if convocatoria.causa else "General",
            "estado": convocatoria.estado,
            "fecha": str(convocatoria.fecha) if convocatoria.fecha else "",
            "hora": str(convocatoria.hora) if convocatoria.hora else "",
            "ubicacion": ubicacion,
            "cupos_totales": convocatoria.cupos_totales,
        },
        "postulantes": postulantes_data,
    }, status=status.HTTP_200_OK)


@api_view(["PATCH", "PUT"])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_actualizar_convocatoria(request, convocatoria_id):
    """Permite al administrador cambiar el estado o datos clave de una convocatoria."""
    user_data, error = obtener_usuario_desde_token(request)
    if error or not user_data:
        return Response({"message": error or "No autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    user_id = user_data.get("id")
    if not es_usuario_admin(user_id):
        return Response({"message": "Acceso restringido a administradores."}, status=status.HTTP_403_FORBIDDEN)

    convocatoria = Convocatoria.objects.filter(id=convocatoria_id).first()
    if not convocatoria:
        return Response({"message": "Convocatoria no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    if "estado" in data:
        convocatoria.estado = data["estado"].strip().upper()
    if "titulo" in data:
        convocatoria.titulo = data["titulo"].strip()
    if "descripcion" in data:
        convocatoria.descripcion = data["descripcion"].strip()
    if "cupos_totales" in data:
        try:
            convocatoria.cupos_totales = int(data["cupos_totales"])
        except (ValueError, TypeError):
            pass
    if "fecha" in data and data["fecha"]:
        convocatoria.fecha = data["fecha"]
    if "hora" in data and data["hora"]:
        convocatoria.hora = data["hora"]

    convocatoria.save()

    return Response({
        "message": "Convocatoria actualizada con éxito.",
        "id": str(convocatoria.id),
        "estado": convocatoria.estado,
    }, status=status.HTTP_200_OK)




