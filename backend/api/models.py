import uuid
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
    inscriptos_actuales = models.IntegerField(blank=True, null=True)
    lugares_libres = models.IntegerField(blank=True, null=True)
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
    ong_email_contacto = models.CharField(max_length=255, blank=True, null=True)

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


class VistaConvocatoriasMapa(models.Model):
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
    inscriptos_actuales = models.IntegerField(blank=True, null=True)
    lugares_libres = models.IntegerField(blank=True, null=True)
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
    ong_email_contacto = models.CharField(max_length=255, blank=True, null=True)

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
        db_table = "vista_convocatorias_mapa"

    def __str__(self):
        return f"{self.titulo} ({self.nombre_organizacion})"


class Provincia(models.Model):
    id = models.SmallIntegerField(primary_key=True)
    nombre = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = "provincias"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Localidad(models.Model):
    id = models.IntegerField(primary_key=True)
    provincia = models.ForeignKey(
        Provincia,
        on_delete=models.DO_NOTHING,
        db_column="provincia_id",
        related_name="localidades",
    )
    nombre = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = "localidades"
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.provincia.nombre})"

class Administrador(models.Model):
    id = models.UUIDField(primary_key=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "administradores"

    def __str__(self):
        return f"{self.nombre} {self.apellido} (Admin)"


class Ong(models.Model):
    id = models.UUIDField(primary_key=True)
    nombre_organizacion = models.CharField(max_length=255)
    cuit = models.CharField(max_length=20, blank=True, null=True)
    descripcion_institucional = models.TextField(blank=True, null=True)
    provincia = models.ForeignKey(
        Provincia,
        on_delete=models.DO_NOTHING,
        db_column="provincia_id",
        blank=True,
        null=True,
    )
    localidad = models.ForeignKey(
        Localidad,
        on_delete=models.DO_NOTHING,
        db_column="localidad_id",
        blank=True,
        null=True,
    )
    direccion = models.CharField(max_length=255, blank=True, null=True)
    telefono_contacto = models.CharField(max_length=50, blank=True, null=True)
    email_contacto = models.EmailField(blank=True, null=True)
    contacto = models.CharField(max_length=255, blank=True, null=True)
    sitio_web = models.CharField(max_length=255, blank=True, null=True)
    link_donacion = models.CharField(max_length=500, blank=True, null=True)
    logo_url = models.CharField(max_length=500, blank=True, null=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    esta_verificada = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "ongs"

    def __str__(self):
        return self.nombre_organizacion


class Causa(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "causas"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Convocatoria(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ong = models.ForeignKey(
        Ong,
        on_delete=models.DO_NOTHING,
        db_column="ong_id",
        related_name="convocatorias",
    )
    causa = models.ForeignKey(
        Causa,
        on_delete=models.DO_NOTHING,
        db_column="causa_id",
        related_name="convocatorias",
        blank=True,
        null=True,
    )
    estado = models.CharField(max_length=50, default="ABIERTA")
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    provincia = models.ForeignKey(
        Provincia,
        on_delete=models.DO_NOTHING,
        db_column="provincia_id",
        blank=True,
        null=True,
    )
    localidad = models.ForeignKey(
        Localidad,
        on_delete=models.DO_NOTHING,
        db_column="localidad_id",
        blank=True,
        null=True,
    )
    direccion = models.CharField(max_length=255, blank=True, null=True)
    lugar = models.CharField(max_length=255, blank=True, null=True)
    fecha = models.DateField(blank=True, null=True)
    hora = models.TimeField(blank=True, null=True)
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    cupos_totales = models.IntegerField(default=10)
    horas_estimadas = models.IntegerField(default=4)
    requiere_aprobacion = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "convocatorias"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.titulo} - {self.ong.nombre_organizacion if self.ong else ''}"


class Voluntario(models.Model):
    id = models.UUIDField(primary_key=True)
    nombre = models.CharField(max_length=150)
    apellido = models.CharField(max_length=100)
    email = models.CharField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=30, blank=True, null=True)
    dni = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "voluntarios"

    def __str__(self):
        return f"{self.nombre} {self.apellido}"


class Postulacion(models.Model):
    class Estado(models.TextChoices):
        POSTULADO = "POSTULADO", "Postulado"
        CONFIRMADO = "CONFIRMADO", "Confirmado"
        ASISTIO = "ASISTIO", "Asistió"
        CANCELADO = "CANCELADO", "Cancelado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    convocatoria = models.ForeignKey(
        Convocatoria,
        on_delete=models.CASCADE,
        db_column="convocatoria_id",
        related_name="postulaciones",
    )
    voluntario = models.ForeignKey(
        Voluntario,
        on_delete=models.CASCADE,
        db_column="voluntario_id",
        related_name="postulaciones",
    )
    estado = models.CharField(
        max_length=50,
        choices=Estado.choices,
        default=Estado.POSTULADO,
    )
    codigo_validacion = models.CharField(max_length=100, blank=True, null=True)
    horas_acreditadas = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "postulaciones"
        unique_together = (("convocatoria", "voluntario"),)

    def __str__(self):
        return f"{self.voluntario} -> {self.convocatoria}"

