import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError

load_dotenv()

def obtener_respuesta_gemini(historial_mensajes, prompt_sistema):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("La API Key de Gemini no está configurada en las variables de entorno.")

    os.environ["GEMINI_API_KEY"] = api_key
    client = genai.Client()

    config = {
        "system_instruction": prompt_sistema,
        "temperature": 0.3,
        "max_output_tokens": 1000,
    }

    max_intentos = 3
    
    for intento in range(max_intentos):
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=historial_mensajes,
                config=config,
            )
            texto_respuesta = response.text if response.text else "No pude procesar tu solicitud."

            # Limpieza de asteriscos y formato Markdown
            texto_limpio = texto_respuesta.replace("**", "").replace("*", "").strip()

            # Recorte de seguridad si por alguna razón la oración quedara inconclusa
            if texto_limpio and not texto_limpio.endswith(('.', '!', '?')):
                ultimo_punto = max(texto_limpio.rfind('.'), texto_limpio.rfind('!'), texto_limpio.rfind('?'))
                if ultimo_punto != -1:
                    texto_limpio = texto_limpio[:ultimo_punto + 1]

            return texto_limpio

        except APIError as e:
            print(f"ERROR DE API DETALLADO (Intento {intento + 1}/{max_intentos}): {e}")
            error_str = str(e)

            # Si es un error 503 o 429 y nos quedan intentos, reintentamos
            if ("429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "503" in error_str or "UNAVAILABLE" in error_str) and intento < max_intentos - 1:
                time.sleep(1.5)
                continue

            # Si se agotaron los intentos:
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                return "Has alcanzado el límite diario de consultas permitidas por la inteligencia artificial. Por favor, inténtalo mañana."
            elif "503" in error_str or "UNAVAILABLE" in error_str or "high demand" in error_str:
                return "TeAyudoIA está recibiendo muchas consultas en este momento. Por favor, intentá nuevamente en unos minutos."
            
            return "Disculpá, el asistente no está disponible temporalmente. Por favor, intentá más tarde."

        except Exception as e:
            print(f"ERROR GENERAL DETALLADO: {e}")
            return "Ocurrió un error inesperado al procesar tu mensaje. Por favor, intentá de nuevo."