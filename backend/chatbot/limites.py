import time
from django.core.cache import cache

def verificar_limites(request):
    """
    Verifica los límites de uso por minuto y diarios para evitar abusos
    y proteger la cuota gratuita de la API.
    Retorna (permitido: bool, mensaje_error: str)
    """
    # Identificar al usuario por IP o sesión
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR', 'anon')

    # Definición de topes (puedes ajustarlos según lo requerido)
    limite_diario = 10
    limite_minuto = 4
    limite_global_diario = 300
    limite_global_minuto = 10

    hoy = time.strftime("%Y-%m-%d")
    minuto_actual = time.strftime("%Y-%m-%d-%H-%M")

    # Claves de caché
    clave_min_user = f"chat_min_{ip}_{minuto_actual}"
    clave_dia_user = f"chat_dia_{ip}_{hoy}"
    clave_min_global = f"chat_min_global_{minuto_actual}"
    clave_dia_global = f"chat_dia_global_{hoy}"

    # 1. Verificar límite por minuto del usuario
    peticiones_min_user = cache.get(clave_min_user, 0)
    if peticiones_min_user >= limite_minuto:
        return False, "Has enviado demasiados mensajes muy rápido. Por favor, espera un minuto."

    # 2. Verificar límite diario del usuario
    peticiones_dia_user = cache.get(clave_dia_user, 0)
    if peticiones_dia_user >= limite_diario:
        return False, "Has alcanzado el límite diario de mensajes para el asistente. Inténtate mañana."

    # 3. Verificar límites globales
    peticiones_min_glob = cache.get(clave_min_global, 0)
    if peticiones_min_glob >= limite_global_minuto:
        return False, "El servicio de asistencia está muy ocupado en este momento. Inténtalo en unos segundos."

    peticiones_dia_glob = cache.get(clave_dia_global, 0)
    if peticiones_dia_glob >= limite_global_diario:
        return False, "Se ha alcanzado el límite global diario de consultas al asistente."

    # Incrementar contadores en caché (expiran según corresponda)
    cache.set(clave_min_user, peticiones_min_user + 1, 60)
    cache.set(clave_dia_user, peticiones_dia_user + 1, 86400)
    cache.set(clave_min_global, peticiones_min_glob + 1, 60)
    cache.set(clave_dia_global, peticiones_dia_glob + 1, 86400)

    return True, ""