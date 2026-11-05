import os

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class ProveedorError(Exception):
    """El proveedor no pudo responder: hay que probar con el siguiente."""


def obtener_respuesta_groq(historial, prompt_sistema, modo_json=False):
    """modo_json=True: devuelve el texto sin limpiar (el JSON lo pide el prompt
    y lo valida busqueda.validar_filtros_ia)."""
    api_key = os.getenv("GROQ_API_KEY")
    modelo = os.getenv("GROQ_MODEL")
    if not api_key or not modelo:
        raise ProveedorError("Falta GROQ_API_KEY o GROQ_MODEL en el .env")

    # El historial viene en formato Gemini: [{"role": "user", "parts": [{"text": ...}]}]
    # Groq usa el formato de OpenAI: [{"role": "user", "content": ...}]
    mensajes = [{"role": "system", "content": prompt_sistema}]
    for m in historial:
        rol = "assistant" if m["role"] == "model" else "user"
        mensajes.append({"role": rol, "content": m["parts"][0]["text"]})

    try:
        res = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            # "low": los modelos gpt-oss piensan menos antes de responder (más rápido y gasta menos tokens)
            json={"model": modelo, "messages": mensajes, "temperature": 0.1, "max_tokens": 1000,
                  "reasoning_effort": "low"},
            timeout=10,  # corto a propósito: si tarda, pasamos al siguiente proveedor
        )
        res.raise_for_status()
        texto = res.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        raise ProveedorError(f"Groq falló: {e}") from e

    # gpt-oss "piensa" antes de responder; si gastó todos los tokens pensando,
    # la respuesta puede venir vacía: eso también cuenta como fallo.
    if not texto or not texto.strip():
        raise ProveedorError("Groq devolvió una respuesta vacía")

    if modo_json:
        return texto.strip()
    return texto.replace("**", "").replace("*", "").strip()
