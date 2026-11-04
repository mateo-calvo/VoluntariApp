import os
import unittest

from django.test import TestCase
from dotenv import load_dotenv
from google import genai

load_dotenv()

# Llama a la API real de Gemini (red y cuota): solo se corre a pedido.
#   RUN_LIVE_TESTS=1 python manage.py test chatbot
@unittest.skipUnless(os.getenv("RUN_LIVE_TESTS") == "1", "Test en vivo: definí RUN_LIVE_TESTS=1 para correrlo")
class GeminiIntegrationTest(TestCase):
    def test_gemini_conexion_directa(self):
        api_key = os.getenv("GEMINI_API_KEY")
        print("\n--- INICIANDO TEST DE CONEXIÓN CON GEMINI ---")
        
        self.assertIsNotNone(api_key, "GEMINI_API_KEY no está definida en el .env")

        os.environ["GEMINI_API_KEY"] = api_key

        try:
            client = genai.Client()
            response = client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
                contents="Responde únicamente la palabra 'CONECTADO'.",
            )
            print(f"Respuesta recibida de Gemini: {response.text.strip()}")
            self.assertTrue(len(response.text) > 0)
            print("--- TEST COMPLETADO CON ÉXITO ---\n")
        except Exception as error:
            print(f"Error detectado al consultar la API: {error}")
            raise error