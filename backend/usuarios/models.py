from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    """Crea usuarios usando el email en lugar de un username."""

    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        # Django solo pasa a minúsculas el dominio. Acá pasamos todo y sacamos espacios,
        # así "  Ana@Mail.com " y "ana@mail.com" son el mismo usuario.
        # Lo usan create_user, el clean() del modelo (admin y formularios) y save().
        return (email or "").strip().lower()

    def get_by_natural_key(self, username):
        # La usa authenticate() en el login: buscamos con el email ya normalizado.
        return super().get_by_natural_key(self.normalize_email(username))

    def _create_user(self, email, password, **extra_fields):
        email = self.normalize_email(email)
        if not email:
            raise ValueError("El email es obligatorio.")
        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # guarda el hash, nunca el texto plano
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("rol", Usuario.Rol.ADMIN)
        return self._create_user(email, password, **extra_fields)


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        VOLUNTARIO = "voluntario", "Voluntario"
        ONG = "ong", "ONG"
        ADMIN = "admin", "Admin"

    username = None
    email = models.EmailField(unique=True)
    nombre = models.CharField(max_length=150)
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.VOLUNTARIO)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre"]  # los pide createsuperuser además de email y password

    objects = UsuarioManager()

    def save(self, *args, **kwargs):
        # Red de seguridad: normaliza aunque el email se haya asignado a mano.
        self.email = Usuario.objects.normalize_email(self.email)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} ({self.rol})"
