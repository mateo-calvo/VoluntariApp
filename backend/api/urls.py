from django.urls import path

from . import views

urlpatterns = [
    # Auth
    path("auth/register-voluntario", views.register_voluntario, name="register_voluntario"),
    path("auth/register-ong", views.register_ong, name="register_ong"),
    path("auth/login", views.login_view, name="login"),

    # Convocatorias (mapa y listado)
    path("convocatorias/", views.listar_convocatorias, name="listar_convocatorias"),

    # Provincias
    path("provincias/", views.listar_provincias, name="listar_provincias"),
    # Localidades
    path("localidades/", views.listar_localidades, name="listar_localidades"),

]
