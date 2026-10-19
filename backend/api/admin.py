from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Usuario


class UsuarioAdmin(BaseUserAdmin):
    ordering = ["email"]
    list_display = ["email", "nombre", "rol", "is_staff"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Información personal", {"fields": ("nombre", "rol")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "nombre", "rol", "password"),
        }),
    )


admin.site.register(Usuario, UsuarioAdmin)
