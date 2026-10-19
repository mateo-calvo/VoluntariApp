from rest_framework.throttling import AnonRateThrottle


class RegistroThrottle(AnonRateThrottle):
    """Límite de intentos de registro por IP (frena la enumeración de emails con el 409).

    El límite está en settings.py → REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["registro"].
    """

    scope = "registro"
