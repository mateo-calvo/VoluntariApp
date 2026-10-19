from django.urls import path

from . import views

urlpatterns = [
    # Auth
    path("auth/register-voluntario", views.register_voluntario, name="register_voluntario"),

    # Convocatorias (mapa y listado)
    path("convocatorias/", views.listar_convocatorias, name="listar_convocatorias"),
]
