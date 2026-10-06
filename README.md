# VoluntariApp

> Conectamos voluntarios con ONGs de Buenos Aires, Argentina.

VoluntariApp es una plataforma web que elimina la burocracia del voluntariado: cualquier persona puede descubrir convocatorias en un mapa interactivo y participar en minutos, y las organizaciones gestionan su ficha pública y sus cupos desde su propio panel.

---

## Funcionalidades

### Mapa público de convocatorias
- 12 convocatorias geolocalizadas en CABA con Leaflet + OpenStreetMap.
- Búsqueda por nombre o zona, filtros por categoría y distancia, geolocalización.
- Detalle de cada convocatoria: descripción, necesidades, cupos disponibles, sitio web, donación y contacto.

### Voluntarios
- Registro e inicio de sesión.
- **Quiero participar** en convocatorias (con retorno automático al mapa tras loguearse).
- Panel **Mis participaciones**: historial con fecha, acceso al mapa y opción de anular.

### ONGs
- Registro en 2 pasos: datos legales + perfil público.
- Autocompletado de ubicación estilo Google Maps (Nominatim + Photon, sin API key).
- Aparecen en el mapa con badge "En revisión" hasta ser verificadas.
- Panel **Mi ONG**: edición de ficha pública (categoría, ubicación, descripción, necesidades, web, donación, contacto, cupos).

### Administración
- Panel con métricas, gestión de ONGs (**aceptar, revocar, rechazar**), y tabla de usuarios.

---

## Vocabulario del proyecto

| Término | Significado |
|---|---|
| cupos | Lugares disponibles por convocatoria |
| convocatoria | Oportunidad publicada por una ONG |
| Quiero participar | Acción del voluntario para sumarse |
| Categorías | Desarrollo social · Salud · Educación · Medioambiente · Infancias y juventudes · Derechos humanos |

---

## Stack

HTML · CSS (tokens centralizados en `css/tokens.css`) · JavaScript vanilla · Leaflet · Nominatim / Photon. Sin build ni dependencias: se abre directo en el navegador. Los datos de la demo se guardan en `localStorage`.

---

## Cómo ejecutarlo

```bash
# Opción 1: abrir index.html en el navegador
# Opción 2: servir la carpeta (ej. VS Code Live Server o cualquier hosting estático)
```

### Cuentas demo

| Rol | Email | Contraseña |
|---|---|---|
| Voluntario | `demo@voluntariapp.org` | `demo1234` |
| ONG | `ong@test.com` | `demo1234` |
| Admin | `admin@test.com` | `demo1234` |

> El mapa y el buscador de direcciones requieren internet (tiles, CDN y geocodificación).

---

## Estructura

```
index.html                  # Landing
pages/                      # login · register · recuperar · mapa ·
                            # participaciones · mi-ong · admin (+ sus .js)
css/                        # tokens.css · styles · login · register ·
                            # recuperar · mapa · panel
images/                     # logo y fotos
```

---

## Flujo de trabajo

- `main` contiene lo último revisado.
- Todo cambio va en una rama `feature/...` + Pull Request contra `main`.

---

MIT · 2026 VoluntariApp
