def procesar_mensaje_usuario(historial, vista_actual="voluntario"):
    if not historial or not historial[-1].get("parts"):
        return "Hola, ¿en qué te puedo ayudar hoy?"
    
    mensaje_usuario = historial[-1]["parts"][0].get("text", "").lower().strip()

    if vista_actual == "voluntario":
        # 0. Cortesía y saludos generales
        if any(w in mensaje_usuario for w in ["gracias", "muchas gracias", "te agradezco", "genial", "excelente", "perfecto"]):
            return "¡De nada! Estoy para ayudarte en lo que necesites dentro de VoluntariApp."
        elif any(w in mensaje_usuario for w in ["hola", "buenas", "holis", "saludos"]):
            return "¡Hola! ¿En qué te puedo ayudar hoy con tus voluntariados?"
        elif any(w in mensaje_usuario for w in ["chau", "adios", "adiós", "hasta luego"]):
            return "¡Chau! Que tengas un gran día y muchos éxitos con tus actividades solidarias."

        # 1. Donaciones específicas
        elif any(w in mensaje_usuario for w in ["causa", "causas", "proyecto", "proyectos"]) and any(w in mensaje_usuario for w in ["donar", "dono", "donacion", "donación", "ayudar"]):
            return "Las donaciones a causas u ONGs van destinadas directamente a financiar sus proyectos solidarios y se gestionan desde el detalle de cada causa."
        elif any(w in mensaje_usuario for w in ["donar", "dono", "donacion", "donación", "app", "plata", "dinero", "ayuda economica"]):
            return "Las donaciones a la app son para mantener funcionando VoluntariApp y se realizan desde el botón Donar en la página de inicio."
        
        # 2. Acciones generales del mapa y postulaciones
        elif any(w in mensaje_usuario for w in ["buscar", "mapa", "ong", "causa", "filtrar", "categoria", "encontrar"]):
            return "Podes buscar organizaciones y causas usando la barra superior del mapa interactivo o filtrando por categorías y distancia."
        elif any(w in mensaje_usuario for w in ["postular", "inscribir", "anotar", "unirme", "sumarme"]):
            return "Para postularte, hace clic en una ONG del mapa o de la lista lateral para abrir su panel de detalles y sumarte."
        elif any(w in mensaje_usuario for w in ["mis", "panel", "participaciones", "estado"]):
            return "Podes revisar el estado de tus postulaciones actuales desde la sección de tu panel de participaciones."
        else:
            return "No entendí muy bien tu consulta. Podes consultarme sobre cómo buscar causas, postularte, ver tus participaciones o donar."

    else:  # Vista ONG
        # 0. Cortesía y saludos generales para ONG
        if any(w in mensaje_usuario for w in ["gracias", "muchas gracias", "te agradezco", "genial", "excelente", "perfecto"]):
            return "¡De nada! Un gusto colaborar con la gestión de tu organización."
        elif any(w in mensaje_usuario for w in ["hola", "buenas", "holis", "saludos"]):
            return "¡Hola! ¿En qué te puedo ayudar hoy con la administración de tu ONG?"
        elif any(w in mensaje_usuario for w in ["chau", "adios", "adiós", "hasta luego"]):
            return "¡Hasta luego! Éxitos en la gestión de tus convocatorias."

        # 1. Donaciones generales y a la app (para que también responda acá)
        elif any(w in mensaje_usuario for w in ["donar", "dono", "donacion", "donación", "app", "plata", "dinero", "ayuda economica"]):
            return "Las donaciones a la app son para mantener funcionando VoluntariApp y se realizan desde el botón Donar en la página de inicio."

        # 2. Gestión de ONG
        elif any(w in mensaje_usuario for w in ["publicar", "convocatoria", "convocatorias", "vacante", "vacantes", "crear"]):
            return "Para publicar o gestionar convocatorias y vacantes abiertas, ingresa a la sección Vacantes desde tu menú lateral."
        elif any(w in mensaje_usuario for w in ["solicitud", "solicitudes", "postulante", "postulantes", "postulacion", "postulación", "postulaciones", "interesado", "interesados"]):
            return "Podes revisar las postulaciones y solicitudes de los voluntarios interesados directamente desde la sección Solicitudes."
        elif any(w in mensaje_usuario for w in ["voluntario", "voluntarios", "activo", "activos", "equipo"]):
            return "Para consultar los voluntarios activos de tu organización, revisa la sección Voluntarios en tu panel."
        elif any(w in mensaje_usuario for w in ["perfil", "nombre", "mision", "misión", "telefono", "teléfono", "editar"]):
            return "Para editar la información pública que verán los voluntarios en el mapa, ingresa a la sección Mi Perfil."
        elif any(w in mensaje_usuario for w in ["pago", "pagos", "alias", "donacion", "donación", "donaciones", "financiero"]):
            return "Para configurar los métodos de pago, Alias o el objetivo financiero de tu ONG, dirígete a la sección Donaciones."
        else:
            return "No entendí muy bien tu consulta. Como organización, podés administrar tus vacantes, revisar solicitudes y actualizar tu perfil desde el menú de gestión."