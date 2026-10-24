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
    path("ong/convocatorias/<uuid:convocatoria_id>/postulaciones", views.ong_convocatoria_postulaciones, name="ong_convocatoria_postulaciones"),
    path("ong/postulaciones/<uuid:postulacion_id>", views.ong_actualizar_postulacion, name="ong_actualizar_postulacion"),

    # Causas / Categorías
    path("causas/", views.listar_causas, name="listar_causas"),

    # Convocatorias (mapa y listado)
    path("convocatorias/", views.listar_convocatorias, name="listar_convocatorias"),
    path("convocatorias/<uuid:id>/participar", views.postular_convocatoria, name="postular_convocatoria"),
    path("voluntario/mis-postulaciones", views.mis_postulaciones, name="mis_postulaciones"),

    # Provincias
    path("provincias/", views.listar_provincias, name="listar_provincias"),
    # Localidades
    path("localidades/", views.listar_localidades, name="listar_localidades"),

    # Admin Panel
    path("admin/dashboard", views.admin_dashboard, name="admin_dashboard"),
    path("admin/ongs/<uuid:ong_id>/verificar", views.admin_verificar_ong, name="admin_verificar_ong"),
]

