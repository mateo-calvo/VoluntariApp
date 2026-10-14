# Backend de VoluntariApp

Django + Django REST Framework + SQLite (desarrollo).

## Puesta en marcha (Windows / PowerShell)

Desde la carpeta `backend/`:

```powershell
# 1. Crear el entorno virtual (una sola vez)
py -3.12 -m venv .venv

# 2. Activarlo (cada vez que abrís una terminal nueva)
.\.venv\Scripts\Activate.ps1

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Crear las tablas en db.sqlite3
python manage.py migrate

# 5. Levantar el servidor en http://127.0.0.1:8000
python manage.py runserver
```

Si PowerShell no deja activar el venv, corré una vez:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## Probar que levanta

```powershell
curl.exe http://127.0.0.1:8000/api/health/
# {"status":"ok"}
```

## Clave secreta

`SECRET_KEY` se lee de la variable de entorno `DJANGO_SECRET_KEY`. Sin ella se usa
una clave de desarrollo. Nunca escribas una clave real en el código ni la subas a git.

```powershell
$env:DJANGO_SECRET_KEY = "una-clave-larga-y-aleatoria"
```

## Estructura

- `config/`: settings y URLs del proyecto.
- `usuarios/`: modelo `Usuario` (login con email, campo `rol`: voluntario, ong o admin).
