# Backend de VoluntariApp

Django + Django REST Framework + Supabase (PostgreSQL & Auth).

## Requisitos previos

- Python 3.12+
- Archivo `.env` en `backend/` con las credenciales de Supabase:
  ```env
  DJANGO_SECRET_KEY=clave-secreta-de-desarrollo
  DJANGO_DEBUG=True
  DB_NAME=postgres
  DB_USER=postgres.fzfiwitvjqlrqimxxcmt
  DB_PASSWORD=tu_password_supabase
  DB_HOST=aws-1-sa-east-1.pooler.supabase.com
  DB_PORT=5432
  SUPABASE_URL=https://fzfiwitvjqlrqimxxcmt.supabase.co
  SUPABASE_ANON_KEY=tu_anon_key
  ```

## Puesta en marcha

### En Windows (PowerShell):
Desde la carpeta `backend/`:
```powershell
# 1. Crear el entorno virtual (solo la primera vez)
py -3.12 -m venv .venv

# 2. Activarlo
.\.venv\Scripts\Activate.ps1

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Levantar el servidor en http://127.0.0.1:8000
python manage.py runserver
```

### En Linux / macOS (Bash):
Desde la raíz del proyecto:
```bash
# 1. Crear y activar entorno virtual
python3 -m venv .venv
source .venv/bin/activate

# 2. Instalar dependencias
pip install -r backend/requirements.txt

# 3. Levantar el servidor
python backend/manage.py runserver
```

---

## 👥 Usuarios de Prueba para Testing

El sistema cuenta con usuarios reales en Supabase para probar cada rol:

| Rol | Email | Contraseña | Destino tras login |
|---|---|---|---|
| **Voluntario** | `analubari@gmail.com` | `Voluntario123!` | Redirige al mapa de convocatorias (`mapa.html`) |
| **ONG** | `contacto@cruzroja.org.ar` | `Ong1234!` | Redirige al panel de la ONG (`mi-ong.html`) |
| **Admin** | `admin@voluntariapp.org` | `Admin1234!` | Redirige al panel de administración (`admin.html`) |

> En la pantalla de login (`pages/login.html`) se encuentran los botones de acceso rápido que permiten seleccionar el rol y adaptan el contexto del formulario.

---

## 🛡️ Cómo crear un nuevo Usuario Administrador

En VoluntariApp, el rol `admin` se determina si el usuario existe en la tabla `public.administradores`:

1. Registra un nuevo usuario voluntario desde `pages/register.html` o crea el usuario en Supabase Auth.
2. Abre la consola de Django:
   ```bash
   python backend/manage.py shell
   ```
3. Ejecuta el siguiente comando reemplazando con el email del usuario:
   ```python
   from django.db import connection

   email = "nuevo_admin@correo.com"
   with connection.cursor() as cursor:
       cursor.execute("SELECT id FROM auth.users WHERE email = %s", [email])
       user_id = cursor.fetchone()[0]
       cursor.execute(
           "INSERT INTO public.administradores (id, nombre, apellido) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING;",
           [user_id, "Nombre", "Apellido"]
       )
   print("¡Usuario ascendido a administrador con éxito!")
   ```
4. Al volver a iniciar sesión, el backend le responderá con `rol: "admin"` y podrá acceder a `pages/admin.html`.
