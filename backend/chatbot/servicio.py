from datetime import datetime
from api.models import Convocatoria

def procesar_mensaje_usuario(historial, vista_actual="voluntario"):
    if not historial or not historial[-1].get("parts"):
        return "Hola, ¿en qué te puedo ayudar hoy?"
    
    mensaje_actual = historial[-1]["parts"][0].get("text", "").lower().strip()
    
    # Contexto acumulado de toda la charla para mantener memoria
    historial_texto = " ".join([
        msg.get("parts", [{}])[0].get("text", "").lower() 
        for msg in historial if "parts" in msg
    ])

    if vista_actual == "voluntario":
        # 0. Saludos y cortesías
        if any(w in mensaje_actual for w in ["gracias", "muchas gracias", "te agradezco", "genial", "excelente", "perfecto"]):
            return "¡De nada! Estoy para ayudarte en lo que necesites dentro de VoluntariApp."
        elif any(w in mensaje_actual for w in ["hola", "buenas", "holis", "saludos"]):
            return "¡Hola! ¿En qué te puedo ayudar hoy con tus voluntariados?"
        elif any(w in mensaje_actual for w in ["chau", "adios", "adiós", "hasta luego"]):
            return "¡Chau! Que tengas un gran día y muchos éxitos con tus actividades solidarias."

        # 1. Donaciones
        elif any(w in mensaje_actual for w in ["donar", "dono", "donacion", "donación", "app", "plata", "dinero"]):
            return "Las donaciones a la app son para mantener funcionando VoluntariApp y se realizan desde el botón Donar en la página de inicio."

        # ==========================================
        # 1.1 RESPUESTAS A CONSULTAS PREDETERMINADAS Y GUÍAS DE LA APP
        # ==========================================
        elif any(w in mensaje_actual for w in ["cómo postularme", "como postularme", "postular", "inscribir", "unirme", "sumarme"]):
            return "Para postularte a un voluntariado, hacé clic en una ONG del mapa o de la lista lateral para abrir su panel de detalles y presioná el botón 'Quiero participar'."
        
        elif any(w in mensaje_actual for w in ["cancelar postulación", "cancelar postulacion", "cancelar mi postulacion", "no puedo asistir"]):
            return "Para ver o gestionar tus inscripciones, podés ingresar a la sección 'Mis participaciones' en la barra superior de la plataforma."
        
        elif any(w in mensaje_actual for w in ["múltiples postulaciones", "multiples postulaciones", "varias postulaciones"]):
            return "¡Sí! Podés anotarte en múltiples organizaciones y actividades solidarias desde la plataforma siempre que lo necesites."
        
        elif any(w in mensaje_actual for w in ["filtros del mapa", "filtrar"]):
            return "Podés filtrar las convocatorias desde la barra superior del mapa interactivo seleccionando categorías específicas, fechas o rangos de distancia."
        
        elif any(w in mensaje_actual for w in ["iconos del mapa", "iconos"]):
            return "Los iconos en el mapa interactivo representan las distintas causas de las organizaciones para que las identifiques visualmente."

        # 1.5 Validación de ubicación y respuesta fluida cuando el usuario confirma que ya la activó
        elif any(w in mensaje_actual for w in ["cerca", "cercano", "cercanos", "km", "kilometro", "kilómetros", "radio", "distancia", "cerca de"]):
            return "Para buscar por rango o distancia, necesitás activar tu ubicación en el mapa interactivo."
        
        elif any(w in historial_texto for w in ["necesitás activar tu ubicación", "activar tu ubicación"]) and any(w in mensaje_actual for w in ["activa", "activo", "ya esta", "ya está", "listo", "ya la active", "si", "ok", "perfecto"]):
            total_convocatorias = Convocatoria.objects.count()
            return f"¡Perfecto! Al estar en entorno local o con la ubicación simulada, tengo {total_convocatorias} convocatorias registradas. ¿Qué causa te interesa buscar (por ejemplo: salud, educación, animales, desarrollo social) o preferís filtrarlas por zona?"

        # 2. Extracción de filtros acumulativos del historial y Supabase
        try:
            # A) Causas
            causa_detectada = None
            if any(w in historial_texto for w in ["animal", "animales", "perros", "gatos"]):
                causa_detectada = "Animales"
            elif any(w in historial_texto for w in ["social", "comedor", "merendero", "alimentos", "desarrollo social"]):
                causa_detectada = "Desarrollo social"
            elif any(w in historial_texto for w in ["salud", "hospital", "sangre", "primeros auxilios"]):
                causa_detectada = "Salud"
            elif any(w in historial_texto for w in ["educacion", "educación", "apoyo escolar", "clases", "tutorías"]):
                causa_detectada = "Educación"
            elif any(w in historial_texto for w in ["medioambiente", "medio ambiente", "ecologia", "ecología", "difusión"]):
                causa_detectada = "Medioambiente"
            elif any(w in historial_texto for w in ["infancias", "juventudes", "niños", "jóvenes"]):
                causa_detectada = "Infancias y juventudes"
            elif any(w in historial_texto for w in ["derechos humanos"]):
                causa_detectada = "Derechos humanos"

            # B) Zonas / Barrios
            barrios_conocidos = [
                "palermo", "lanus", "lanús", "avellaneda", "recoleta", "belgrano", 
                "caballito", "almagro", "caba", "centro", "la boca", "puerto madero", 
                "san telmo", "barracas", "villa crespo", "flores", "retiro", "ituzaingo", "la plata"
            ]
            zona_detectada = next((b.capitalize() for b in barrios_conocidos if b in historial_texto), None)

            # C) Fechas exactas o días
            import re
            match_fecha = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b', historial_texto)
            fecha_exacta = None
            if match_fecha:
                dia, mes, anio = match_fecha.groups()
                if len(anio) == 2:
                    anio = "20" + anio
                fecha_exacta = f"{anio}-{int(mes):02d}-{int(dia):02d}"

            dias_mapa = {
                "domingo": 1, "domingos": 1, "lunes": 2, "martes": 3,
                "miercoles": 4, "miércoles": 4, "jueves": 5, "viernes": 6,
                "sabado": 7, "sábado": 7, "sabados": 7, "sábados": 7
            }
            dia_detectado_num = None
            dia_nombre_texto = None
            if not fecha_exacta:
                for dia_clave, num_dia in dias_mapa.items():
                    if dia_clave in historial_texto:
                        dia_detectado_num = num_dia
                        dia_nombre_texto = dia_clave.capitalize()
                        break

            # D) Turnos horarios
            turno_detectado = None
            if any(w in historial_texto for w in ["mañana", "am", "9", "8", "10", "11"]):
                turno_detectado = "mañana"
            elif any(w in historial_texto for w in ["tarde", "pm", "14", "15", "16", "17", "18"]):
                turno_detectado = "tarde"
            elif any(w in historial_texto for w in ["noche", "19", "20", "21"]):
                turno_detectado = "noche"

            # E) Preguntas de seguimiento (dónde, qué zona, horario)
            pide_ubicacion = any(w in mensaje_actual for w in ["donde", "dónde", "ubicacion", "ubicación", "direccion", "dirección", "lugar", "zona"])
            pide_horario = any(w in mensaje_actual for w in ["horario", "hora", "cuando", "cuándo"])

            # Si hay filtros o preguntas de seguimiento en curso
            if causa_detectada or zona_detectada or fecha_exacta or dia_detectado_num or turno_detectado or pide_ubicacion or pide_horario:
                resultados = Convocatoria.objects.all()

                if causa_detectada:
                    resultados = resultados.filter(causa__nombre__icontains=causa_detectada)
                if zona_detectada:
                    resultados = resultados.filter(localidad__nombre__icontains=zona_detectada) | resultados.filter(lugar__icontains=zona_detectada)
                if fecha_exacta:
                    resultados = resultados.filter(fecha=fecha_exacta)
                elif dia_detectado_num:
                    resultados = resultados.filter(fecha__week_day=dia_detectado_num)

                if turno_detectado == "mañana":
                    resultados = resultados.filter(hora__gte="06:00:00", hora__lte="12:00:00")
                elif turno_detectado == "tarde":
                    resultados = resultados.filter(hora__gt="12:00:00", hora__lte="19:00:00")
                elif turno_detectado == "noche":
                    resultados = resultados.filter(hora__gt="19:00:00")

                cantidad = resultados.count()

                # Control inteligente si la combinación exacta da 0 resultados pero teníamos zona + turno
                if cantidad == 0 and (zona_detectada and turno_detectado):
                    res_zona = Convocatoria.objects.filter(localidad__nombre__icontains=zona_detectada) | Convocatoria.objects.filter(lugar__icontains=zona_detectada)
                    res_turno = Convocatoria.objects.all()
                    if turno_detectado == "mañana":
                        res_turno = res_turno.filter(hora__gte="06:00:00", hora__lte="12:00:00")
                    elif turno_detectado == "tarde":
                        res_turno = res_turno.filter(hora__gt="12:00:00", hora__lte="19:00:00")
                    elif turno_detectado == "noche":
                        res_turno = res_turno.filter(hora__gt="19:00:00")

                    return f"No tengo en {zona_detectada} por la {turno_detectado}, pero tengo {res_zona.count()} en {zona_detectada} en otros horarios y {res_turno.count()} por la {turno_detectado} en otras zonas."

                if cantidad > 0:
                    if pide_ubicacion:
                        detalles = [f"• **{c.ong.nombre if hasattr(c, 'ong') else 'Organización'}** ({c.lugar or c.direccion})" for c in resultados[:3]]
                        return f"Aquí tenés las zonas y ubicaciones de los resultados:\n" + "\n".join(detalles) + "\n\nPodes ver todas en el mapa."
                    elif pide_horario:
                        detalles = [f"• **{c.ong.nombre if hasattr(c, 'ong') else 'Organización'}**: {c.fecha} a las {c.hora} hs" for c in resultados[:3]]
                        return f"Aquí tenés los horarios:\n" + "\n".join(detalles) + "\n\nPodes ver más en el mapa."
                    else:
                        mensaje_resp = f"¡Sí, tengo {cantidad} organizacion{'es' if cantidad > 1 else ''}"
                        if causa_detectada:
                            mensaje_resp += f" de {causa_detectada.lower()}"
                        if zona_detectada:
                            mensaje_resp += f" en {zona_detectada}"
                        if turno_detectado:
                            mensaje_resp += f" por la {turno_detectado}"
                        mensaje_resp += "!\n\nPodes ver los detalles en el mapa interactivo superior."
                        return mensaje_resp
                else:
                    return "No encontré convocatorias exactas con esos filtros, pero podés explorar el mapa interactivo."
        except Exception:
            pass

        # 3. Ayuda general
        if any(w in mensaje_actual for w in ["mapa", "filtrar", "encontrar"]):
            return "Podes buscar organizaciones y causas usando la barra superior del mapa interactivo o filtrando por categorías y distancia."
        else:
            return "No entendí muy bien tu consulta. Podes consultarme sobre cómo buscar causas por zona, fecha, día u horario."

    else:  # Vista ONG
        if any(w in mensaje_actual for w in ["publicar", "convocatoria", "vacante", "crear"]):
            return "Para publicar o gestionar convocatorias y vacantes abiertas, ingresa a la sección Vacantes desde tu menú lateral."
        elif any(w in mensaje_actual for w in ["solicitud", "postulante"]):
            return "Podes revisar las solicitudes de los voluntarios directamente desde la sección Solicitudes."
        else:
            return "No entendí muy bien tu consulta. Como organización, podés administrar tus vacantes y revisar solicitudes."