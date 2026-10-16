from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Usuario


class RegistroVoluntarioSerializer(serializers.Serializer):
    """Valida los datos del registro de voluntario.

    Solo acepta nombre, email y password: si el cliente manda otros campos
    (por ejemplo "rol": "admin"), se ignoran. El rol lo decide el servidor.
    """

    nombre = serializers.CharField(min_length=2, max_length=150, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate_email(self, value):
        return Usuario.objects.normalize_email(value)

    def validate(self, data):
        # Validadores de settings.AUTH_PASSWORD_VALIDATORS: largo mínimo,
        # contraseñas comunes, solo números y parecido al email o al nombre.
        usuario_tmp = Usuario(email=data["email"], nombre=data["nombre"])
        try:
            validate_password(data["password"], user=usuario_tmp)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data

    def create(self, validated_data):
        return Usuario.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],  # create_user la hashea
            nombre=validated_data["nombre"],
            rol=Usuario.Rol.VOLUNTARIO,
        )
