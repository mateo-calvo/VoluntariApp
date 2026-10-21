from django.test import TestCase

# Create your tests here.
import os
from django.test import TestCase
from dotenv import load_dotenv
from google import genai

load_dotenv()

class GeminiIntegrationTest(TestCase):
    def test_gemini_conexion_directa(self):
        api_key = os.getenv("GEMINI_API_KEY")
        print("\n--- INICIANDO TEST DE CONEXIÓN CON GEMINI ---")
        
        self.assertIsNotNone(api_key, "GEMINI_API_KEY no está definida en el .env")

        os.environ["GEMINI_API_KEY"] = api_key

        try:
            client = genai.Client()
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents="Responde únicamente la palabra 'CONECTADO'.",
            )
            print(f"Respuesta recibida de Gemini: {response.text.strip()}")
            self.assertTrue(len(response.text) > 0)
            print("--- TEST COMPLETADO CON ÉXITO ---\n")
        except Exception as error:
            print(f"Error detectado al consultar la API: {error}")
            raise error