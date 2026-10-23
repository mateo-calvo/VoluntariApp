import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .limites import verificar_limites
from .servicio import procesar_mensaje_usuario

@csrf_exempt
@require_POST
def responder_chat(request):
    try:
        permitido, mensaje_error, consultas_restantes = verificar_limites(request)
        if not permitido:
            return JsonResponse({"error": mensaje_error}, status=429)

        data = json.loads(request.body)
        mensaje_usuario = data.get("mensaje", "").strip()
        vista_actual = data.get("vista", "voluntario").lower()

        if not mensaje_usuario:
            return JsonResponse({"error": "El mensaje no puede estar vacío."}, status=400)

        historial = [
            {
                "role": "user",
                "parts": [{"text": mensaje_usuario}]
            }
        ]

        respuesta_bot = procesar_mensaje_usuario(historial, vista_actual)

        # Agregamos un aviso amigable según las consultas que le queden
        if consultas_restantes == 0:
            respuesta_bot += " (Esta fue tu última consulta disponible por hoy)."
        elif consultas_restantes <= 3:
            respuesta_bot += f" (Te quedan {consultas_restantes} consultas por hoy)."

        return JsonResponse({"respuesta": respuesta_bot}, status=200)

    except ValueError as ve:
        traceback.print_exc()
        return JsonResponse({"error": str(ve)}, status=500)
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"error": "Ocurrió un error al procesar tu solicitud."}, status=500)