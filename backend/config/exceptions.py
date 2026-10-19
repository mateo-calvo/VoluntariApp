import math

from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler


def mensaje_throttled(wait):
    """Texto para el 429. wait = segundos que faltan (puede venir None)."""
    if wait is None:
        return "Demasiados intentos. Intenta de nuevo más tarde."
    minutos = max(1, math.ceil(wait / 60))
    unidad = "minuto" if minutos == 1 else "minutos"
    return f"Demasiados intentos. Intenta de nuevo en {minutos} {unidad}."


def json_message_exception_handler(exc, context):
    """Errores de DRF con la forma que espera el front: { "message": "..." }.

    DRF responde { "detail": "..." } ante JSON malformado, método no permitido,
    falta de permisos, etc. Acá lo renombramos a "message".
    """
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, Throttled):
        # El texto de DRF ("Solicitud fue regulada...") es confuso: lo reemplazamos.
        # El header Retry-After lo pone DRF y se mantiene.
        response.data = {"message": mensaje_throttled(exc.wait)}
    elif response is not None and isinstance(response.data, dict) and "detail" in response.data:
        response.data = {"message": str(response.data["detail"])}
    return response
