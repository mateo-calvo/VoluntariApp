"""Límites de uso del chat.

Dos capas:
1. Endpoint (verificar_limites): por IP y, si el usuario inició sesión, por usuario. Aplica a TODOS
   los mensajes, incluso los que se contestan sin IA.
2. Llamadas a la IA (reservar_llamada_ia): un tope global por minuto y por día, solo para cuando
   realmente se llama a Groq o Gemini. Si se llega al tope, el FAQ y las reglas siguen respondiendo.

Los números son configurables por variables de entorno (ver .env.example). Los valores por defecto
son prudentes para un plan gratuito de Groq/Gemini, pero hay que confirmarlos con la cuota actual
que muestra la consola de cada proveedor.

La caché es la de Django (en memoria de cada proceso): con varios workers cada uno cuenta por su
cuenta. Para producción conviene Redis o DatabaseCache.
"""
import os
import time

from django.core.cache import cache
from rest_framework.throttling import BaseThrottle

POR_DEFECTO = {
    "CHAT_LIMITE_USUARIO_MIN": 8,
    "CHAT_LIMITE_USUARIO_DIA": 150,
    # Más alto que el de usuario: en una demo todo el curso comparte el wifi, o sea la misma IP
    "CHAT_LIMITE_IP_MIN": 15,
    "CHAT_LIMITE_IP_DIA": 300,
    "CHAT_IA_LIMITE_MIN": 20,
    "CHAT_IA_LIMITE_DIA": 300,
}

MSG_RAPIDO = "Mandaste demasiados mensajes muy rápido. Esperá un minuto y probá de nuevo."
MSG_DIA = "Llegaste al límite diario de mensajes del asistente. Probá de nuevo mañana."


def limite(nombre):
    """El límite configurado en el entorno, o el de por defecto si falta o no es un número válido."""
    try:
        valor = int(os.environ.get(nombre, ""))
    except ValueError:
        return POR_DEFECTO[nombre]
    return valor if valor >= 0 else POR_DEFECTO[nombre]


def _contar(clave, segundos):
    """Suma 1 al contador (atómico) y devuelve el valor nuevo."""
    cache.add(clave, 0, segundos)
    try:
        return cache.incr(clave)
    except ValueError:  # venció justo entre el add y el incr
        cache.set(clave, 1, segundos)
        return 1


def _minuto():
    return time.strftime("%Y-%m-%d-%H-%M")


def _dia():
    return time.strftime("%Y-%m-%d")


def identificar_usuario(request):
    """ID del usuario si manda un token de Supabase válido; None si no hay token o es inválido
    (un token inválido es un usuario anónimo, no un error)."""
    if not request.headers.get("Authorization", "").startswith("Bearer "):
        return None
    from api.views import obtener_usuario_desde_token  # acá, para no cargar todo api al importar el chat
    try:
        usuario, error = obtener_usuario_desde_token(request)
    except Exception:
        return None
    if error or not usuario:
        return None
    return str(usuario.get("id") or "") or None


def verificar_limites(request):
    """(permitido, mensaje de error, consultas que le quedan hoy)."""
    # Misma lógica que el throttling de DRF: respeta NUM_PROXIES (settings). Con NUM_PROXIES=0 ignora
    # X-Forwarded-For (lo escribe el cliente y se puede falsificar); con N > 0 toma la IP que agregó
    # el último proxy de confianza. Sin cookies ni sesiones: el cliente no puede "renovarse".
    ip = BaseThrottle().get_ident(request) or "anon"

    # 1. La IP primero: es barato y evita que un token inventado dispare consultas a Supabase
    por_minuto = _contar(f"chat_ip_min_{ip}_{_minuto()}", 60)
    por_dia = _contar(f"chat_ip_dia_{ip}_{_dia()}", 86400)
    if por_minuto > limite("CHAT_LIMITE_IP_MIN"):
        return False, MSG_RAPIDO, 0
    if por_dia > limite("CHAT_LIMITE_IP_DIA"):
        return False, MSG_DIA, 0
    restantes = limite("CHAT_LIMITE_IP_DIA") - por_dia

    # 2. El usuario, si inició sesión
    usuario = identificar_usuario(request)
    if usuario:
        por_minuto = _contar(f"chat_usuario_min_{usuario}_{_minuto()}", 60)
        por_dia = _contar(f"chat_usuario_dia_{usuario}_{_dia()}", 86400)
        if por_minuto > limite("CHAT_LIMITE_USUARIO_MIN"):
            return False, MSG_RAPIDO, 0
        if por_dia > limite("CHAT_LIMITE_USUARIO_DIA"):
            return False, MSG_DIA, 0
        restantes = min(restantes, limite("CHAT_LIMITE_USUARIO_DIA") - por_dia)

    return True, "", restantes


def reservar_llamada_ia():
    """True si queda cupo para una llamada a la IA (tope global por minuto y por día).
    Se pide justo antes de llamar a Groq o Gemini; el FAQ y las reglas no pasan por acá."""
    if _contar(f"chat_ia_min_{_minuto()}", 60) > limite("CHAT_IA_LIMITE_MIN"):
        return False
    return _contar(f"chat_ia_dia_{_dia()}", 86400) <= limite("CHAT_IA_LIMITE_DIA")
