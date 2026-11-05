"""Búsqueda de convocatorias por reglas (sin IA). SOLO LECTURA.

Es la búsqueda de Natalia, corregida: detecta causa, lugar, fecha y turno en el mensaje y
cuenta las convocatorias ABIERTAS que coinciden. Es el respaldo de la búsqueda con IA
(si Groq y Gemini fallan, se usa esto).

Reglas que cumple:
- Las causas y los lugares salen de la base (nunca de listas fijas), y se comparan por
  palabras completas: nada de substrings ("am" no es "cambiar", "plata" no es "La Plata").
- Un filtro que no se puede aplicar (un lugar que no existe, por ejemplo) da cero resultados
  y la respuesta dice qué no se encontró. Nunca se ignora en silencio.
- Si la base falla, no se traga el error: se registra y se sigue con el resto del flujo.
"""
import re
import time
from datetime import date, time as hora_del_dia

from django.db import DatabaseError
from django.db.models import Q

from api.models import Causa, Convocatoria, Localidad, Provincia

from .faq import normalizar


# ──────────────────────────────────────────────────────────────
# Nombres de la base (causas, localidades, provincias)
# Se guardan 10 minutos en memoria: se usan en cada mensaje y no queremos
# una consulta a la base por cada uno.
# ──────────────────────────────────────────────────────────────

CACHE_SEGUNDOS = 600
_cache = {}


def _nombres(clave, consulta):
    guardado = _cache.get(clave)
    if guardado and time.monotonic() - guardado[0] < CACHE_SEGUNDOS:
        return guardado[1]
    valores = sorted(set(consulta()))
    _cache[clave] = (time.monotonic(), valores)
    return valores


def nombres_de_causas():
    return _nombres("causas", lambda: Causa.objects.values_list("nombre", flat=True))


def lugares_disponibles():
    """Todas las localidades y provincias de la tabla (tengan o no convocatorias)."""
    return _nombres("lugares", lambda: list(Localidad.objects.values_list("nombre", flat=True))
                    + list(Provincia.objects.values_list("nombre", flat=True)))


def nombra(texto_normalizado, nombre):
    """True si el nombre aparece como palabra completa ("como" no matchea "comodoro")."""
    nombre = normalizar(nombre)
    return bool(nombre) and re.search(rf"\b{re.escape(nombre)}\b", texto_normalizado) is not None


def el_mas_largo_nombrado(texto_normalizado, nombres):
    """De los nombres que aparecen en el texto, el más largo ("ciudad autonoma de buenos aires" le gana a "buenos aires")."""
    nombrados = [n for n in set(nombres) if n and nombra(texto_normalizado, n)]
    return max(nombrados, key=lambda n: len(normalizar(n))) if nombrados else None


# ──────────────────────────────────────────────────────────────
# Causa por palabras ("animales" -> "Protección Animal")
# Siempre contra los nombres reales de la tabla: si la base no tiene esa causa, no se inventa.
# ──────────────────────────────────────────────────────────────

# Palabras de los nombres de causas que son demasiado generales para decidir solas
PALABRAS_GENERICAS = {"medio", "primeros"}
# Palabras del texto que se parecen a una causa pero no lo son ("saludos" no es "Salud")
NO_SON_CAUSA = {"saludos"}


def _palabras_importantes(texto, ignorar=()):
    return [p for p in normalizar(texto).split() if len(p) >= 4 and p not in ignorar]


def _misma_palabra(a, b):
    """Comparten las primeras 5 letras (o son iguales si alguna es más corta)."""
    n = min(5, len(a), len(b))
    return a[:n] == b[:n] and (n == 5 or a == b)


def _puntaje_causa(texto, nombre_causa):
    palabras_texto = _palabras_importantes(texto, NO_SON_CAUSA)
    palabras_causa = _palabras_importantes(nombre_causa, PALABRAS_GENERICAS)
    return sum(1 for pc in palabras_causa if any(_misma_palabra(pt, pc) for pt in palabras_texto))


def causa_mencionada(texto, causas):
    """La causa de la lista que mejor coincide por palabras con el texto, o None (también si hay empate)."""
    puntajes = sorted(((_puntaje_causa(texto, c), c) for c in causas), reverse=True)
    if not puntajes or puntajes[0][0] == 0:
        return None
    if len(puntajes) > 1 and puntajes[1][0] == puntajes[0][0]:
        return None
    return puntajes[0][1]


# ──────────────────────────────────────────────────────────────
# Lugar: uno de la tabla, o uno que parece un lugar pero no está ("en Rosario")
# ──────────────────────────────────────────────────────────────

DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

# Nombres comunes que la tabla escribe distinto
ALIAS_LUGARES = {
    "caba": "Ciudad Autónoma de Buenos Aires",
    "capital federal": "Ciudad Autónoma de Buenos Aires",
    "ciudad de buenos aires": "Ciudad Autónoma de Buenos Aires",
}

# "en <algo>" que NO es un lugar ("en serio", "en la app", "en mi barrio", "en noviembre")
NO_SON_LUGAR = {
    "serio", "general", "que", "cual", "cuanto", "donde", "como", "linea", "realidad",
    "total", "particular", "especial", "mi", "mis", "tu", "tus", "su", "sus", "nuestro", "nuestra",
    "la app", "app", "la aplicacion", "aplicacion", "la pagina", "la web", "el mapa", "mapa",
    "algo", "alguna", "algun", "cualquier", "todo", "todos", "otro", "otra", "ese", "esa", "lo", "medio",
    "grupo", "equipo", "familia", "persona", "casa", "la semana", "semana", "el dia", "la tarde",
    "la noche", "la manana", "vacaciones", "verano", "invierno", "enero", "febrero", "marzo", "abril", "mayo",
    "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    "la seccion", "la plataforma", "plataforma", "el sitio", "el perfil", "la cuenta", "mi cuenta",
}
# Palabras donde termina el nombre del lugar ("en rosario este finde" -> "rosario")
CORTAN_LUGAR = set(DIAS) | {"hoy", "manana", "pasado", "este", "esta", "finde", "fin", "para", "con",
                            "que", "y", "o", "hay", "cerca", "de", "a", "por", "sobre", "desde", "hasta"}
PALABRAS_MAXIMAS_LUGAR = 4
ARTICULOS_SUELTOS = {"el", "la", "los", "las", "del", "un", "una"}

# Frases con las que alguien pide convocatorias concretas. Hace falta una de estas para que
# un "en <palabra>" desconocido se tome por un lugar ("¿cómo me registro en la sección?" no lo es).
SENALES_BUSQUEDA = [
    r"\b(convocatorias?|voluntariados?)\s+(en|cerca)\b",
    r"\bcercan?[ao]?s?\b",
    r"\bhay\s+(alguna?s?\s+|algun\s+)?(convocatorias?|voluntariados?|actividad(es)?)\b",
    r"\b(que|cuales)\s+(convocatorias?|voluntariados?|actividades)\b",
    r"\b(convocatorias?|voluntariados?)\s+(de|para)\b",
    r"\bquiero\s+ayudar\s+(en|con|a)\b",
    r"\bbusco\s+(un\s+)?(voluntariados?|convocatorias?)\b",
    r"\bdonde\s+puedo\s+ayudar\b",
    r"\b(?:que hay|hay algo) en\b",
]


def hay_senal_de_busqueda(texto_normalizado):
    return any(re.search(p, texto_normalizado) for p in SENALES_BUSQUEDA)


def lugar_oficial(nombre, lugares):
    """Nombre tal como está en la tabla (con alias), o None si no existe."""
    pedido = normalizar(nombre)
    pedido = normalizar(ALIAS_LUGARES.get(pedido, pedido))
    return next((l for l in lugares if normalizar(l) == pedido), None)


def _candidatos_lugar(texto_normalizado):
    """Cada "en <palabras>" que podría ser un lugar (pasa las exclusiones). No consulta la base."""
    for encontrado in re.finditer(r"\ben ([a-z0-9 ]+)", texto_normalizado):
        palabras = []
        for palabra in encontrado.group(1).split()[:PALABRAS_MAXIMAS_LUGAR]:
            if palabra in CORTAN_LUGAR:
                break
            palabras.append(palabra)
        # Artículos que quedan colgando: "en el finde" -> "el" -> nada
        while palabras and palabras[-1] in ARTICULOS_SUELTOS:
            palabras.pop()
        candidato = " ".join(palabras)
        if candidato and not any(candidato == e or candidato.startswith(e + " ") for e in NO_SON_LUGAR):
            yield candidato


def lugar_no_reconocido(texto_normalizado, causas):
    """Primer "en <palabras>" que parezca un lugar, aunque no esté en la tabla."""
    for candidato in _candidatos_lugar(texto_normalizado):
        # "voluntariados en educación" habla de una causa, no de un lugar
        if not causa_mencionada(candidato, causas):
            return candidato
    return None


# ──────────────────────────────────────────────────────────────
# Fecha y turno
# ──────────────────────────────────────────────────────────────

# Número de día para el filtro fecha__week_day de Django (1 = domingo)
DIA_SEMANA_DJANGO = {"domingo": 1, "lunes": 2, "martes": 3, "miercoles": 4, "jueves": 5, "viernes": 6, "sabado": 7}
DIA_SEMANA_MOSTRAR = {1: "domingos", 2: "lunes", 3: "martes", 4: "miércoles", 5: "jueves", 6: "viernes", 7: "sábados"}
SINGULAR_DIA = {"domingos": "domingo", "sabados": "sabado"}
PATRON_DIA = re.compile(r"\b(domingos?|lunes|martes|miercoles|jueves|viernes|sabados?)\b")
PATRON_FECHA_EXACTA = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b")

# Turnos: de qué a qué hora (Natalia: mañana 6-12, tarde 12-19, noche después de las 19)
TURNOS = {
    "mañana": (hora_del_dia(6, 0), hora_del_dia(12, 0)),
    "tarde": (hora_del_dia(12, 0), hora_del_dia(19, 0)),
    "noche": (hora_del_dia(19, 0), hora_del_dia(23, 59, 59)),
}
# "mañana" sola es el día de mañana, no el turno: solo vale "a/por/en/de la mañana"
PATRON_TURNO = re.compile(r"\b(?:la (manana)|(tarde|noche)s?)\b")
PATRON_HORA = re.compile(r"\b(?:a las?|desde las?)\s+(\d{1,2})\b|\b(\d{1,2})\s*(?:hs|horas?|h)\b")
PATRON_HORA_AMPM = re.compile(r"\b(\d{1,2})\s*(am|pm)\b")


def _turno_de_la_hora(hora):
    if 6 <= hora <= 11:
        return "mañana"
    if 12 <= hora <= 19:
        return "tarde"
    if 20 <= hora <= 23:
        return "noche"
    return None


def detectar_turno(texto_normalizado):
    encontrado = PATRON_TURNO.search(texto_normalizado)
    if encontrado:
        return "mañana" if encontrado.group(1) else encontrado.group(2)
    ampm = PATRON_HORA_AMPM.search(texto_normalizado)
    if ampm:
        hora = int(ampm.group(1)) % 12 + (12 if ampm.group(2) == "pm" else 0)
        return _turno_de_la_hora(hora)
    hora = PATRON_HORA.search(texto_normalizado)
    if hora:
        return _turno_de_la_hora(int(hora.group(1) or hora.group(2)))
    return None


def detectar_fecha(texto):
    """Fecha exacta (dd/mm/aaaa). Devuelve (fecha, entendida): una fecha que se escribió pero no existe
    (31/02) no se ignora, se avisa."""
    encontrada = PATRON_FECHA_EXACTA.search(texto.lower())
    if not encontrada:
        return None, True
    dia, mes, anio = (int(n) for n in encontrada.groups())
    if anio < 100:
        anio += 2000
    try:
        return date(anio, mes, dia), True
    except ValueError:
        return None, False


# ──────────────────────────────────────────────────────────────
# 1. ¿Qué pide el mensaje? (sin tocar la base de convocatorias)
# ──────────────────────────────────────────────────────────────

PALABRAS_PIDE_UBICACION = {"donde", "ubicacion", "direccion", "lugar", "zona"}
PALABRAS_PIDE_HORARIO = {"horario", "hora", "horas", "cuando"}


def extraer_filtros(texto):
    """Filtros que pide el mensaje, o None si no es una búsqueda de convocatorias."""
    t = normalizar(texto)
    causas, lugares = nombres_de_causas(), lugares_disponibles()

    causa = causa_mencionada(t, causas)
    nombrado = el_mas_largo_nombrado(t, list(lugares) + list(ALIAS_LUGARES))
    lugar = lugar_oficial(nombrado, lugares) if nombrado else None
    lugar_desconocido = None
    if not lugar:
        # Nombró un lugar que no está en la tabla ("Rosario", o "CABA" si la tabla lo escribe distinto)
        lugar_desconocido = nombrado or (lugar_no_reconocido(t, causas) if hay_senal_de_busqueda(t) else None)

    fecha, fecha_entendida = detectar_fecha(texto)
    dia = PATRON_DIA.search(t)
    dia_semana = None
    if dia and not fecha:
        dia_semana = DIA_SEMANA_DJANGO[SINGULAR_DIA.get(dia.group(1), dia.group(1))]
    turno = detectar_turno(t)

    if not (causa or lugar or lugar_desconocido or fecha or not fecha_entendida or dia_semana or turno):
        return None
    palabras = set(t.split())
    return {
        "causa": causa,
        "lugar": lugar,
        "lugar_desconocido": lugar_desconocido,
        "fecha": fecha,
        "fecha_no_entendida": not fecha_entendida,
        "dia_semana": dia_semana,
        "turno": turno,
        "pide_ubicacion": bool(palabras & PALABRAS_PIDE_UBICACION),
        "pide_horario": bool(palabras & PALABRAS_PIDE_HORARIO),
    }


# ──────────────────────────────────────────────────────────────
# 2. La consulta (solo lectura, solo convocatorias ABIERTAS)
# ──────────────────────────────────────────────────────────────

def _abiertas():
    return Convocatoria.objects.filter(estado="ABIERTA").select_related("ong", "causa", "localidad", "provincia")


def _por_lugar(qs, lugar):
    return qs.filter(Q(localidad__nombre__iexact=lugar) | Q(provincia__nombre__iexact=lugar))


def _por_turno(qs, turno):
    desde, hasta = TURNOS[turno]
    if turno == "mañana":  # 6:00 a 12:00 inclusive (como Natalia)
        return qs.filter(hora__gte=desde, hora__lte=hasta)
    return qs.filter(hora__gt=desde, hora__lte=hasta)


def _aplicar(qs, filtros, con_lugar=True, con_turno=True):
    if filtros["causa"]:
        qs = qs.filter(causa__nombre=filtros["causa"])
    lugar = filtros["lugar"] or filtros["lugar_desconocido"]
    if lugar and con_lugar:
        qs = _por_lugar(qs, lugar)
    if filtros["fecha"]:
        qs = qs.filter(fecha=filtros["fecha"])
    elif filtros["dia_semana"]:
        qs = qs.filter(fecha__week_day=filtros["dia_semana"])
    if filtros["turno"] and con_turno:
        qs = _por_turno(qs, filtros["turno"])
    return qs


# ──────────────────────────────────────────────────────────────
# 3. La respuesta
# ──────────────────────────────────────────────────────────────

MOSTRAR_EN_RESPUESTA = 3


def _limpio(texto, largo=120):
    """Saca < y > (defensa extra contra HTML) y recorta los textos que escriben las ONGs."""
    return re.sub(r"[<>]", "", str(texto or "")).strip()[:largo]


def _titulo(texto):
    """"mar del plata" -> "Mar del Plata" (el texto ya viene normalizado, sin mayúsculas)."""
    return " ".join(p if p in ARTICULOS_SUELTOS | {"de", "y"} else p.capitalize() for p in texto.split())


def _describir(filtros):
    partes = []
    if filtros["causa"]:
        partes.append(f"de {_limpio(filtros['causa'], 60)}")
    lugar = filtros["lugar"] or filtros["lugar_desconocido"]
    if lugar:
        partes.append(f"en {_limpio(lugar, 60)}" if filtros["lugar"] else f"en «{_limpio(_titulo(lugar), 60)}»")
    if filtros["fecha"]:
        partes.append(f"para el {filtros['fecha']:%d/%m/%Y}")
    elif filtros["dia_semana"]:
        partes.append(f"los {DIA_SEMANA_MOSTRAR[filtros['dia_semana']]}")
    if filtros["turno"]:
        partes.append(f"por la {filtros['turno']}")
    return " ".join(partes)


def _detalle(c, filtros):
    # Las ONGs en revisión se incluyen y se marcan, igual que en el mapa
    texto = f"«{_limpio(c.titulo)}» de {_limpio(c.ong.nombre_organizacion)}"
    if not c.ong.esta_verificada:
        texto += " (en revisión)"
    if filtros["pide_ubicacion"]:
        texto += f", en {_limpio(c.lugar or c.direccion or (c.localidad.nombre if c.localidad else ''), 80)}"
    if filtros["pide_horario"]:
        cuando = f"{c.fecha:%d/%m/%Y}" if c.fecha else "fecha a coordinar"
        texto += f", {cuando}" + (f" a las {c.hora:%H:%M}" if c.hora else "")
    return texto


def _plural(n, singular, plural):
    return singular if n == 1 else plural


def responder_busqueda_por_reglas(texto):
    """Respuesta a un pedido de convocatorias, o None si el mensaje no es una búsqueda
    (o la base no responde: se registra y se sigue con el resto del flujo)."""
    try:
        filtros = extraer_filtros(texto)
        if filtros is None:
            return None
        if filtros["fecha_no_entendida"]:
            return "No pude entender esa fecha. Probá escribirla así: 15/11/2026."

        base = _aplicar(_abiertas(), filtros)
        total = base.count()
        descripcion = _describir(filtros)
        espacio = " " if descripcion else ""

        if total:
            texto_ok = (f"Encontré {total} {_plural(total, 'convocatoria abierta', 'convocatorias abiertas')}"
                        f"{espacio}{descripcion}.")
            if filtros["pide_ubicacion"] or filtros["pide_horario"]:
                muestra = list(base.order_by("fecha", "hora")[:MOSTRAR_EN_RESPUESTA])
                texto_ok += " " + "; ".join(_detalle(c, filtros) for c in muestra) + "."
            return texto_ok + " Podés ver los detalles en el mapa."

        texto_no = f"No encontré convocatorias abiertas{espacio}{descripcion}."
        lugar = filtros["lugar"] or filtros["lugar_desconocido"]
        if lugar and filtros["turno"]:
            # Si la combinación lugar + turno da cero, decimos qué existe por separado
            en_lugar = _aplicar(_abiertas(), filtros, con_turno=False).count()
            en_turno = _aplicar(_abiertas(), filtros, con_lugar=False).count()
            if en_lugar or en_turno:
                nombre = filtros["lugar"] or _titulo(filtros["lugar_desconocido"])
                texto_no += (f" Hay {en_lugar} en {_limpio(nombre, 60)} en otros horarios"
                             f" y {en_turno} por la {filtros['turno']} en otras zonas.")
        return texto_no + " Mirá el mapa para ver todas las que hay."
    except DatabaseError as e:
        # No se traga en silencio: queda en el log y el flujo sigue (IA o mensaje de siempre)
        print(f"[CHATBOT] Búsqueda por reglas no disponible: {type(e).__name__}")
        return None
