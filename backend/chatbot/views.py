from django.shortcuts import render

# Create your views here.

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .servicio import procesar_mensaje_usuario
from .limites import verificar_limites

@csrf_exempt
@require_POST
def responder_chat(request):
    try:
        # Verificar restricciones de límites antes de procesar nada
        permitido, mensaje_error = verificar_limites(request)
        if not permitido:
            return JsonResponse({"error": mensaje_error}, status=429) # 429 Too Many Requests

        data = json.loads(request.body)
        mensaje_usuario = data.get("message", "").strip()

        if not mensaje_usuario:
            return JsonResponse({"error": "El mensaje no puede estar vacío."}, status=400)

        # Formato de historial compatible con google-genai
        historial = [
            {
                "role": "user",
                "parts": [{"text": mensaje_usuario}]
            }
        ]

        respuesta_bot = procesar_mensaje_usuario(historial)

        return JsonResponse({"reply": respuesta_bot}, status=200)

    except ValueError as ve:
        return JsonResponse({"error": str(ve)}, status=500)
    except Exception as e:
        return JsonResponse({"error": "Ocurrió un error al procesar tu solicitud."}, status=500)