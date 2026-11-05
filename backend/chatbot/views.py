import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .limites import verificar_limites
from .servicio import procesar_mensaje_usuario

# Cada mensaje puede terminar en una IA: un texto enorme gasta tokens (y plata)
LARGO_MAXIMO_MENSAJE = 500


def leer_ubicacion(data):
    """lat y lng opcionales: solo números (no texto ni booleanos), finitos y en rango.
    Si alguna es inválida o falta, se ignoran las dos. Nunca se loguean."""
    lat, lng = data.get("lat"), data.get("lng")
    for valor, maximo in ((lat, 90), (lng, 180)):
        if isinstance(valor, bool) or not isinstance(valor, (int, float)):
            return None, None
        # Solo comparar el rango: sirve para enteros gigantes (math.isfinite
        # tiraría OverflowError) y NaN/Infinity nunca quedan adentro.
        if not -maximo <= valor <= maximo:
            return None, None
    return float(lat), float(lng)


def error(mensaje, status):
    return JsonResponse({"error": mensaje}, status=status)


@csrf_exempt
@require_POST
def responder_chat(request):
    try:
        permitido, mensaje_error, consultas_restantes = verificar_limites(request)
        if not permitido:
            return error(mensaje_error, 429)

        # Cuerpo: tiene que ser un objeto JSON. Cualquier otra cosa es un 400, no un 500.
        try:
            data = json.loads(request.body)
        except (ValueError, UnicodeDecodeError):
            return error("El formato del mensaje no es válido.", 400)
        if not isinstance(data, dict):
            return error("El formato del mensaje no es válido.", 400)

        mensaje_usuario = data.get("mensaje", "")
        if not isinstance(mensaje_usuario, str):
            return error("El formato del mensaje no es válido.", 400)
        mensaje_usuario = mensaje_usuario.strip()
        if not mensaje_usuario:
            return error("El mensaje no puede estar vacío.", 400)
        if len(mensaje_usuario) > LARGO_MAXIMO_MENSAJE:
            return error(f"El mensaje es demasiado largo: escribí hasta {LARGO_MAXIMO_MENSAJE} caracteres.", 400)

        vista = data.get("vista")
        vista_actual = vista.lower() if isinstance(vista, str) else "voluntario"

        historial = [
            {
                "role": "user",
                "parts": [{"text": mensaje_usuario}]
            }
        ]

        lat, lng = leer_ubicacion(data)
        respuesta_bot = procesar_mensaje_usuario(historial, vista_actual, lat, lng)

        # Agregamos un aviso amigable según las consultas que le queden
        if consultas_restantes == 0:
            respuesta_bot += " (Esta fue tu última consulta disponible por hoy)."
        elif consultas_restantes <= 3:
            respuesta_bot += f" (Te quedan {consultas_restantes} consultas por hoy)."

        return JsonResponse({"respuesta": respuesta_bot}, status=200)

    except Exception:
        # El detalle va al log del servidor, nunca al cliente
        traceback.print_exc()
        return error("Ocurrió un error al procesar tu solicitud.", 500)
