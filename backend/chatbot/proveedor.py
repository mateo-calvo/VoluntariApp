import os

from google import genai
from google.genai.errors import APIError

from .proveedor_groq import ProveedorError


def obtener_respuesta_gemini(historial_mensajes, prompt_sistema):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ProveedorError("La API Key de Gemini no está configurada en las variables de entorno.")

    # timeout en milisegundos; attempts=1 desactiva los reintentos internos de Google:
    # si Gemini no responde, la cadena de proveedores decide qué hacer (no reintentamos acá).
    client = genai.Client(api_key=api_key, http_options={"timeout": 20_000, "retry_options": {"attempts": 1}})

    # El modelo se puede cambiar desde el .env sin tocar el código
    modelo = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    config = {
        "system_instruction": prompt_sistema,
        "temperature": 0.1,
        "max_output_tokens": 1000,
        # Menos "pensamiento" = respuesta más rápida
        "thinking_config": {"thinking_level": "low"},
    }

    try:
        response = client.models.generate_content(
            model=modelo,
            contents=historial_mensajes,
            config=config,
        )
    except APIError as e:
        raise ProveedorError(f"Gemini falló: {e}") from e
    except Exception as e:
        # Errores de red (timeout, sin conexión) y cualquier otro imprevisto
        raise ProveedorError(f"Gemini error inesperado: {type(e).__name__}: {e}") from e

    # Una respuesta sin texto también cuenta como fallo
    if not response.text or not response.text.strip():
        raise ProveedorError("Gemini devolvió una respuesta vacía")

    # Limpieza de asteriscos y formato Markdown
    texto_limpio = response.text.replace("**", "").replace("*", "").strip()

    # Recorte de seguridad si por alguna razón la oración quedara inconclusa
    if not texto_limpio.endswith(('.', '!', '?')):
        ultimo_punto = max(texto_limpio.rfind('.'), texto_limpio.rfind('!'), texto_limpio.rfind('?'))
        if ultimo_punto != -1:
            texto_limpio = texto_limpio[:ultimo_punto + 1]

    return texto_limpio
