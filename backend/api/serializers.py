from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Localidad, Provincia, Usuario, VistaConvocatoriasCards

GENEROS_PERMITIDOS = [
    "Femenino",
    "Masculino",
    "No binario",
    "Prefiero no decirlo",
    "Otro",
]

class RegistroVoluntarioSerializer(serializers.Serializer):
    """Valida los datos del registro de voluntario."""

    nombre = serializers.CharField(min_length=2, max_length=150, trim_whitespace=True)
    apellido = serializers.CharField(min_length=2, max_length=100, trim_whitespace=True)
    dni = serializers.CharField(min_length=6, max_length=20, trim_whitespace=True)
    telefono = serializers.CharField(min_length=6, max_length=30, trim_whitespace=True)
    genero = serializers.ChoiceField(choices=GENEROS_PERMITIDOS)
    fecha_nacimiento = serializers.DateField()
    provincia_id = serializers.IntegerField(min_value=1)
    localidad_id = serializers.IntegerField(min_value=1)
    direccion = serializers.CharField(min_length=3, max_length=255, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate_email(self, value):
        return Usuario.objects.normalize_email(value)

    def validate(self, data):
        usuario_tmp = Usuario(email=data["email"], nombre=data["nombre"])
        try:
            validate_password(data["password"], user=usuario_tmp)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data

    def create(self, validated_data):
        return Usuario.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            nombre=validated_data["nombre"],
            rol=Usuario.Rol.VOLUNTARIO,
        )


class VistaConvocatoriasCardsSerializer(serializers.ModelSerializer):
    class Meta:
        model = VistaConvocatoriasCards
        fields = "__all__"


class ProvinciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provincia
        fields = ["id", "nombre"]


class LocalidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Localidad
        fields = ["id", "nombre", "provincia_id"]



