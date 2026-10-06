# VoluntariApp

> Conectamos voluntarios con ONGs de Buenos Aires, Argentina.

Plataforma web (demo funcional) que elimina la burocracia del voluntariado: cualquier persona descubre convocatorias en un mapa público y participa en minutos. Las ONGs se registran, completan su ficha y aparecen en el mapa. Un admin acepta o rechaza organizaciones.

**Estado:** demo 100% estática (HTML + CSS + JS, sin backend). Los datos se guardan en el navegador (`localStorage`). Ideal para mostrar con pendrive o hosting estático.

---

## Qué puede hacer cada rol

### Visitante (sin cuenta) — mapa público
- Ver las **12 convocatorias** en el mapa interactivo (Leaflet + OpenStreetMap).
- Buscar por nombre o barrio, filtrar por categoría y distancia, usar "Ubicación" (geolocalización).
- Ver el detalle de cada convocatoria: descripción, lo que necesitan, cupos, web, donación y contacto.

### Voluntario (con cuenta)
- Botón **"Quiero participar"** en cada convocatoria (exige iniciar sesión; si no, te lleva al login y vuelve solo).
- Panel **Mis participaciones**: lo que te anotaste, con fecha, link al mapa y opción de anular.
- Estado "Ya estás participando ✓" y control de cupos (no baja de 0, no duplica).

### ONG (con cuenta)
- Registro en **2 pasos**: datos legales → perfil público (categoría, ubicación con autocompletado estilo Google Maps, descripción, necesidades, web, link de donación, contacto).
- Aparece en el mapa con badge **"En revisión"** hasta que el admin la acepta.
- Panel **Mi ONG**: editar la ficha pública cuando quieras.

### Admin (dueño del servicio)
- Panel **Administración**: números, lista de pendientes, **aceptar / revocar / rechazar** (reversible) ONGs y tabla de usuarios.
- Aceptar saca el badge "En revisión"; rechazar oculta la ONG del mapa.

---

## Vocabulario oficial del proyecto

Hablamos como una ONG, no como un sistema corporativo:

| ✅ Usamos | ❌ No usamos |
|---|---|
| cupos | plazas |
| convocatorias (lo que publica la ONG) | candidaturas (eso lo presenta el voluntario) |
| Quiero participar | Postularme |
| Desarrollo social, Salud, Educación, Medioambiente, Infancias y juventudes, Derechos humanos | Ayuda social, Alimentos, Infancia... |

---

## Cómo probarlo (sin instalar nada)

**Opción 1 — doble clic:** abrir `index.html` en el navegador.

**Opción 2 — hosting gratis:** arrastrar la carpeta a Netlify Drop, Vercel o GitHub Pages. Anda directo.

**Cuentas demo** (botones al pie del login, un clic y entrás):

| Rol | Email | Contraseña |
|---|---|---|
| Voluntario | `demo@voluntariapp.org` | `demo1234` |
| ONG | `ong@test.com` | `demo1234` |
| Admin | `admin@test.com` | `demo1234` |

> El mapa necesita internet (tiles de OpenStreetMap, Leaflet por CDN y el buscador de direcciones). Login, registro y paneles andan igual.

**Guion de demo (90 segundos):** mapa en incógnito → filtrar → detalle con Donar/Web → Quiero participar → login demo → vuelve a la convocatoria → participás → ves "Ya estás participando ✓" → como admin aceptás una ONG nueva → aparece verificada.

---

## Estructura del proyecto

```
index.html                  # Landing (hero, cómo funciona, CTA, footer)
pages/
  login.html / login.js         # Login + accesos demo por rol
  register.html / register.js   # Registro voluntario / ONG en 2 pasos + autocompletado (Nominatim + Photon)
  recuperar.html                # Recupero de contraseña (demo)
  mapa.html / mapa.js           # Mapa público de convocatorias (Leaflet)
  participaciones.html/js       # Panel voluntario
  mi-ong.html/js                # Panel ONG (ficha editable)
  admin.html/js                 # Panel admin (aceptar/rechazar, stats, usuarios)
css/
  tokens.css                # Fuente única: colores, radios, sombras, toasts
  styles.css                # Home · login.css / register.css / recuperar.css
  mapa.css / panel.css      # Mapa y paneles
images/                     # logo.png, img1/img2.avif, voluntarios.jpg
```

**Datos demo (navegador):** `va_users_demo` (usuarios), `va_ongs_demo` (ONGs registradas), `va_parts_demo` (participaciones), `va_session` en `sessionStorage`. Borrar datos del sitio = empezar de cero.

---

## Diseño

- **Paleta:** verde `#1A7A5E` · navy `#0F2132` · fondo `#F0F5F4` · verde claro `#E1EEE8`.
- **Fuente:** Nunito Sans. **Idioma:** español argentino.
- Tokens centralizados en `css/tokens.css` (importado por todos los CSS).

---

## Trabajo en equipo (Git)

- `main` es lo último revisado. Todo cambio va en rama `feature/...` + Pull Request (ej: `feature/paneles`, PR #5 de referencia).
- Commits chicos y por tema (diseño / mapa / paneles), no un commit gigante.

---

## Roadmap (después de la demo)

- Backend Node.js + Express + MongoDB (código de referencia guardado fuera del repo): JWT, validaciones en servidor, verificación real.
- `PATCH /api/auth/me` (editar perfil usuario), participantes por convocatoria para la ONG, motivo de rechazo visible.
- Deploy backend (Render/Railway) + Mongo Atlas.

---

MIT · 2026 VoluntariApp
