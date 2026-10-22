from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    """Crea usuarios usando el email en lugar de un username."""

    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        return (email or "").strip().lower()

    def get_by_natural_key(self, username):
        return super().get_by_natural_key(self.normalize_email(username))

    def _create_user(self, email, password, **extra_fields):
        email = self.normalize_email(email)
        if not email:
            raise ValueError("El email es obligatorio.")
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
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
    REQUIRED_FIELDS = ["nombre"]

    objects = UsuarioManager()

    class Meta:
        db_table = "usuarios_usuario"  # Mantiene compatibilidad con la tabla existente

    def save(self, *args, **kwargs):
        self.email = Usuario.objects.normalize_email(self.email)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} ({self.rol})"


class VistaConvocatoriasCards(models.Model):
    convocatoria_id = models.UUIDField(primary_key=True)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    fecha = models.DateField(blank=True, null=True)
    hora = models.TimeField(blank=True, null=True)
    lugar = models.CharField(max_length=255, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    cupos_totales = models.IntegerField(blank=True, null=True)
    horas_estimadas = models.IntegerField(blank=True, null=True)
    requiere_aprobacion = models.BooleanField(default=False)
    estado_convocatoria = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    # Datos de la ONG
    ong_id = models.UUIDField()
    nombre_organizacion = models.CharField(max_length=255)
    ong_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    ong_verificada = models.BooleanField(default=False)
    ong_logo_url = models.CharField(max_length=500, blank=True, null=True)
    ong_link_donacion = models.CharField(max_length=500, blank=True, null=True)

    # Causa
    causa_id = models.IntegerField()
    causa_nombre = models.CharField(max_length=100)

    # Ubicación geográfica
    localidad_id = models.IntegerField()
    localidad_nombre = models.CharField(max_length=100)
    provincia_id = models.IntegerField()
    provincia_nombre = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = "vista_convocatorias_cards"

    def __str__(self):
        return f"{self.titulo} ({self.nombre_organizacion})"
