import re
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


class LoginSerializer(serializers.Serializer):
    """Valida las credenciales de inicio de sesión."""

    email = serializers.EmailField(error_messages={
        "required": "El email es obligatorio.",
        "invalid": "El formato de email no es válido.",
        "blank": "El email no puede estar vacío.",
    })
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        error_messages={
            "required": "La contraseña es obligatoria.",
            "blank": "La contraseña no puede estar vacía.",
        },
    )

    def validate_email(self, value):
        return Usuario.objects.normalize_email(value)


CUIT_REGEX = re.compile(r"^\d{2}-\d{8}-\d$")


class RegistroOngSerializer(serializers.Serializer):
    """Valida los datos de registro de una nueva ONG."""

    razon_social = serializers.CharField(
        min_length=3,
        max_length=150,
        error_messages={
            "required": "La razón social o nombre de la organización es obligatorio.",
            "blank": "La razón social o nombre de la organización no puede estar vacío.",
            "min_length": "El nombre de la organización debe tener al menos 3 caracteres.",
            "max_length": "El nombre de la organización no puede exceder 150 caracteres.",
        },
    )
    cuit = serializers.CharField(
        max_length=15,
        error_messages={
            "required": "El CUIT es obligatorio.",
            "blank": "El CUIT no puede estar vacío.",
        },
    )
    email = serializers.EmailField(
        error_messages={
            "required": "El email de contacto es obligatorio.",
            "invalid": "El formato de email no es válido.",
            "blank": "El email no puede estar vacío.",
        }
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        error_messages={
            "required": "La contraseña es obligatoria.",
            "blank": "La contraseña no puede estar vacía.",
        },
    )
    domicilio = serializers.CharField(
        max_length=200,
        error_messages={
            "required": "El domicilio de la sede es obligatorio.",
            "blank": "El domicilio no puede estar vacío.",
        },
    )
    descripcion = serializers.CharField(
        min_length=10,
        error_messages={
            "required": "La descripción institucional es obligatoria.",
            "blank": "La descripción institucional no puede estar vacía.",
            "min_length": "La descripción institucional debe tener al menos 10 caracteres.",
        },
    )
    contacto = serializers.CharField(
        max_length=100,
        error_messages={
            "required": "El nombre del referente o contacto es obligatorio.",
            "blank": "El nombre del referente no puede estar vacío.",
        },
    )
    telefono = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
    )
    web = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )
    link_pago = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )
    provincia_id = serializers.IntegerField(
        required=True,
        error_messages={
            "required": "La provincia de la organización es obligatoria.",
            "null": "La provincia de la organización no puede ser nula.",
            "invalid": "El identificador de provincia no es válido.",
        },
    )
    localidad_id = serializers.IntegerField(
        required=True,
        error_messages={
            "required": "La localidad de la organización es obligatoria.",
            "null": "La localidad de la organización no puede ser nula.",
            "invalid": "El identificador de localidad no es válido.",
        },
    )

    def to_internal_value(self, data):
        # Permitir tanto camelCase (desde el frontend) como snake_case
        if hasattr(data, "copy"):
            data = data.copy()
        else:
            data = dict(data)

        if "razonSocial" in data and "razon_social" not in data:
            data["razon_social"] = data.pop("razonSocial")
        if "linkPago" in data and "link_pago" not in data:
            data["link_pago"] = data.pop("linkPago")

        return super().to_internal_value(data)

    def validate_email(self, value):
        return Usuario.objects.normalize_email(value)

    def validate_cuit(self, value):
        value = value.strip()
        if not CUIT_REGEX.match(value):
            raise serializers.ValidationError(
                "El CUIT debe tener el formato XX-XXXXXXXX-X (con guiones)."
            )
        return value

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value

    def validate_web(self, value):
        if value:
            value = value.strip()
            if not (value.startswith("http://") or value.startswith("https://")):
                raise serializers.ValidationError(
                    "El sitio web debe comenzar con https:// o http://"
                )
        return value

    def validate_link_pago(self, value):
        if value:
            value = value.strip()
            if not (value.startswith("http://") or value.startswith("https://")):
                raise serializers.ValidationError(
                    "El link de donación/pago debe comenzar con https:// o http://"
                )
        return value