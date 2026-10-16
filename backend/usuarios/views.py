from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Usuario
from .serializers import RegistroVoluntarioSerializer

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
@authentication_classes([])  # ruta pública: nadie está logueado al registrarse
@permission_classes([AllowAny])
def register_voluntario(request):
    serializer = RegistroVoluntarioSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)

    if Usuario.objects.filter(email=serializer.validated_data["email"]).exists():
        return Response({"message": MSG_EMAIL_EXISTE}, status=status.HTTP_409_CONFLICT)

    try:
        serializer.save()
    except IntegrityError:
        # Dos registros con el mismo email casi al mismo tiempo.
        return Response({"message": MSG_EMAIL_EXISTE}, status=status.HTTP_409_CONFLICT)

    # No devolvemos el usuario: el front no lo necesita y así nunca se filtra el hash.
    return Response({"message": "Cuenta creada con éxito."}, status=status.HTTP_201_CREATED)
