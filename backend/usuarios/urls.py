from django.urls import path

from . import views

# Sin barra final: el front llama a /api/auth/register-voluntario
urlpatterns = [
    path("register-voluntario", views.register_voluntario),
]
