from .busqueda import responder_busqueda_por_reglas
from .faq import normalizar, respuesta_directa
from .ia import responder_con_ia

# Último recurso: lo que se responde si no hay FAQ, búsqueda ni IA que sirva
NO_ENTENDI = {
    "voluntario": "No entendí muy bien tu consulta. Podés preguntarme cómo postularte, usar el mapa, buscar convocatorias por zona, fecha o causa, o cómo donar.",
    "ong": "No entendí muy bien tu consulta. Como organización, podés preguntarme cómo publicar convocatorias, gestionar postulantes o editar tu perfil.",
}

# Cortesías. Se detectan por palabra o frase completa y solo en mensajes cortos y sin pregunta:
# "hola" va acá, pero "hola, ¿cómo cancelo?" tiene que responder sobre cancelar.
# El orden importa: "gracias" gana si el mensaje trae más de una.
CORTESIAS = (
    (("gracias", "muchas gracias", "te agradezco", "genial", "excelente", "perfecto"), {
        "voluntario": "¡De nada! Estoy para ayudarte en lo que necesites dentro de VoluntariApp.",
        "ong": "¡De nada! Un gusto colaborar con la gestión de tu organización.",
    }),
    (("hola", "holis", "buenas", "buen dia", "buenos dias", "buenas tardes", "buenas noches", "saludos"), {
        "voluntario": "¡Hola! ¿En qué te puedo ayudar hoy con tus voluntariados?",
        "ong": "¡Hola! ¿En qué te puedo ayudar hoy con la administración de tu ONG?",
    }),
    (("chau", "adios", "hasta luego"), {
        "voluntario": "¡Chau! Que tengas un gran día y muchos éxitos con tus actividades solidarias.",
        "ong": "¡Hasta luego! Éxitos en la gestión de tus convocatorias.",
    }),
)
MAXIMO_PALABRAS_CORTESIA = 4


def responder_cortesia(texto, vista):
    normalizado = normalizar(texto)
    if "?" in texto or not normalizado or len(normalizado.split()) > MAXIMO_PALABRAS_CORTESIA:
        return None
    marco = f" {normalizado} "
    for frases, respuestas in CORTESIAS:
        if any(f" {frase} " in marco for frase in frases):
            return respuestas[vista]
    return None


def procesar_mensaje_usuario(historial, vista_actual="voluntario"):
    if not historial or not historial[-1].get("parts"):
        return "Hola, ¿en qué te puedo ayudar hoy?"

    texto = historial[-1]["parts"][0].get("text", "").strip()
    vista = "voluntario" if vista_actual == "voluntario" else "ong"

    # 1. Coincidencia fuerte con el FAQ: respuesta tal cual, sin gastar IA
    respuesta = respuesta_directa(texto, vista)
    if respuesta:
        return respuesta

    # 2. Saludos y agradecimientos
    respuesta = responder_cortesia(texto, vista)
    if respuesta:
        return respuesta

    # 3. Búsqueda de convocatorias por reglas (solo voluntarios)
    if vista == "voluntario":
        respuesta = responder_busqueda_por_reglas(texto)
        if respuesta:
            return respuesta

    # 4. IA con el FAQ como única fuente; si fallan todas, el mensaje de siempre
    return responder_con_ia(historial, vista) or NO_ENTENDI[vista]
