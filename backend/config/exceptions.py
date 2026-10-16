from rest_framework.views import exception_handler


def json_message_exception_handler(exc, context):
    """Errores de DRF con la forma que espera el front: { "message": "..." }.

    DRF responde { "detail": "..." } ante JSON malformado, método no permitido,
    falta de permisos, etc. Acá lo renombramos a "message".
    """
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and "detail" in response.data:
        response.data = {"message": str(response.data["detail"])}
    return response
