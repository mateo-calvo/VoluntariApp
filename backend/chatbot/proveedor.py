import os
from google import genai
from google.genai import types

def obtener_respuesta_gemini(historial_mensajes, prompt_sistema):
    """
    Se comunica directamente con la API de Google Gemini utilizando
    el paquete oficial google-genai y el modelo gemini-2.5-flash.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("La API Key de Gemini no está configurada en las variables de entorno.")

    client = genai.Client(api_key=api_key)

    # Configuración del modelo y prompt del sistema
    config = types.GenerateContentConfig(
        system_instruction=prompt_sistema,
        temperature=0.7,
        max_output_tokens=500,
    )

    # Llamada al modelo gemini-2.5-flash
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=historial_mensajes,
        config=config,
    )

    return response.text