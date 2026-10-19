from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Usuario, VistaConvocatoriasCards
from .serializers import RegistroVoluntarioSerializer, VistaConvocatoriasCardsSerializer
from .throttles import RegistroThrottle

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
    """Registro público de un voluntario."""
    serializer = RegistroVoluntarioSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"message": primer_error(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)

    if Usuario.objects.filter(email=serializer.validated_data["email"]).exists():
        return Response({"message": MSG_EMAIL_EXISTE}, status=status.HTTP_409_CONFLICT)

    try:
        serializer.save()
    except IntegrityError:
        return Response({"message": MSG_EMAIL_EXISTE}, status=status.HTTP_409_CONFLICT)

    return Response({"message": "Cuenta creada con éxito."}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def listar_convocatorias(request):
    """Devuelve las convocatorias públicas consumiendo la vista de Supabase."""
    convocatorias = VistaConvocatoriasCards.objects.all()
    serializer = VistaConvocatoriasCardsSerializer(convocatorias, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)
