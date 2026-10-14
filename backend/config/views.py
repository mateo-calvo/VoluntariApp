from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(['GET'])
def health(request):
    """Ruta de prueba: confirma que el backend está levantado."""
    return Response({'status': 'ok'})
