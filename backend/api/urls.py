from django.urls import path

from . import views

urlpatterns = [
    # Auth
    path("auth/register-voluntario", views.register_voluntario, name="register_voluntario"),
    path("auth/register-ong", views.register_ong, name="register_ong"),
    path("auth/login", views.login_view, name="login"),

    # ONG Panel
    path("ong/mi-perfil", views.ong_mi_perfil, name="ong_mi_perfil"),
    path("ong/mis-convocatorias", views.ong_mis_convocatorias, name="ong_mis_convocatorias"),
    path("ong/mis-convocatorias/<uuid:convocatoria_id>", views.ong_detalle_convocatoria, name="ong_detalle_convocatoria"),

    # Causas / Categorías
    path("causas/", views.listar_causas, name="listar_causas"),

    # Convocatorias (mapa y listado)
    path("convocatorias/", views.listar_convocatorias, name="listar_convocatorias"),
    path("convocatorias/<uuid:id>/participar", views.postular_convocatoria, name="postular_convocatoria"),
    path("convocatorias/<uuid:id>/cancelar-participacion", views.cancelar_postulacion, name="cancelar_postulacion"),

    # Voluntario Panel
    path("voluntario/mis-postulaciones", views.voluntario_mis_postulaciones, name="voluntario_mis_postulaciones"),

    # Provincias
    path("provincias/", views.listar_provincias, name="listar_provincias"),
    # Localidades
    path("localidades/", views.listar_localidades, name="listar_localidades"),

]
