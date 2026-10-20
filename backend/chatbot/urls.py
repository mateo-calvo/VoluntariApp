from django.urls import path
from .views import responder_chat

urlpatterns = [
    path('api/chat/', responder_chat, name='responder_chat'),
]