import time
from django.core.cache import cache

def verificar_limites(request):
    # Asegurarnos de que la sesión esté iniciada para tener una clave única por navegador/usuario
    if not request.session.session_key:
        request.session.create()
    
    # Identificador único por sesión de usuario (independiente de la IP compartida de Render)
    session_id = request.session.session_key

    # Límites ampliados para pruebas en equipo en producción
    limite_diario = 500
    limite_minuto = 100
    limite_global_diario = 2000
    limite_global_minuto = 100

    hoy = time.strftime("%Y-%m-%d")
    minuto_actual = time.strftime("%Y-%m-%d-%H-%M")

    # Usamos el session_id en lugar de solo la IP para que cada usuario tenga su contador propio
    clave_min_user = f"chat_min_{session_id}_{minuto_actual}"
    clave_dia_user = f"chat_dia_{session_id}_{hoy}"
    clave_min_global = f"chat_min_global_{minuto_actual}"
    clave_dia_global = f"chat_dia_global_{hoy}"

    # 1. Verificar límites actuales
    if cache.get(clave_min_user, 0) >= limite_minuto:
        return False, "Has enviado demasiados mensajes muy rápido. Por favor, espera un minuto.", 0

    uso_actual = cache.get(clave_dia_user, 0)
    if uso_actual >= limite_diario:
        return False, "Has alcanzado el límite diario de mensajes para el asistente. Inténtalo mañana.", 0

    if cache.get(clave_min_global, 0) >= limite_global_minuto:
        return False, "El servicio de asistencia está muy ocupado en este momento. Inténtalo en unos segundos.", 0

    if cache.get(clave_dia_global, 0) >= limite_global_diario:
        return False, "Se ha alcanzado el límite global diario de consultas al asistente.", 0

    # 2. Incrementar contadores en caché
    try:
        cache.incr(clave_min_user)
    except ValueError:
        cache.set(clave_min_user, 1, 60)

    try:
        nuevo_uso = cache.incr(clave_dia_user)
    except ValueError:
        cache.set(clave_dia_user, 1, 86400)
        nuevo_uso = 1

    try:
        cache.incr(clave_min_global)
    except ValueError:
        cache.set(clave_min_global, 1, 60)

    try:
        cache.incr(clave_dia_global)
    except ValueError:
        cache.set(clave_dia_global, 1, 86400)

    # Calcular cuántas le quedan
    consultas_restantes = limite_diario - nuevo_uso
    return True, "", consultas_restantes