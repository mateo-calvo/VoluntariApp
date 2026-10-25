document.addEventListener("DOMContentLoaded", () => {
  // Evaluamos la vista antes de inyectar el HTML
  const esVistaOng = window.location.pathname.includes('ong');
  const claveSesion = esVistaOng ? 'chat_historial_ong' : 'chat_historial_voluntario';

  // Definimos todas las preguntas rápidas dinámicas según el perfil
  let chipsHTML = "";
  if (esVistaOng) {
    chipsHTML = `
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo publicar una convocatoria?')">¿Cómo publicar convocatoria?</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo edito o cierro una convocatoria publicada?')">¿Cómo editar o cerrar convocatorias?</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Puedo pausar temporariamente una búsqueda de voluntarios?')">¿Cómo pausar una búsqueda?</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo veo los datos de contacto de un voluntario postulado?')">Ver contacto de voluntarios</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo rechazo o acepto una postulación?')">Gestionar postulaciones</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo se gestionan las donaciones que recibe mi causa?')">Donaciones de mi causa</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo donar a la app?')">¿Cómo donar a la app?</button>
    `;
  } else {
    chipsHTML = `
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo postularme a una causa?')">¿Cómo postularme?</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo busco causas cerca de mi ubicación actual?')">Buscar cerca de mí</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Puedo postularme a más de un voluntariado al mismo tiempo?')">Múltiples postulaciones</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo cancelo una postulación si ya no puedo asistir?')">Cancelar postulación</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo usar los filtros del mapa?')">Filtros del mapa</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo guardo causas o las marco como favoritas?')">Guardar favoritas</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Qué significan los iconos en el mapa?')">Iconos del mapa</button>
      <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo donar a la app?')">¿Cómo donar a la app?</button>
    `;
  }

  // Inyección automática del HTML del Chat
  const botHTML = `
    <!-- Botón flotante -->
    <button id="voliToggleBtn" class="bot-trigger-btn">
      <span style="font-size: 20px;">🤖</span>
      <span id="voliBadge" class="badge-help">?</span>
    </button>

    <!-- Modal del Chat -->
    <div id="voliChatModal" class="voli-chat-modal hidden">
      <div class="voli-chat-header">
        <div style="display:flex; align-items:center;">
          <div class="voli-avatar-box">
            🤖
            <div class="online-dot"></div>
          </div>
          <div class="voli-header-info">
            <h4>TeAyudoIA — Asistente</h4>
            <span>VoluntariApp · En línea ahora</span>
          </div>
        </div>
        <div class="voli-header-actions">
          <button id="voliResetBtn" title="Reiniciar chat">↺</button>
          <button id="voliCloseBtn" title="Cerrar">∨</button>
        </div>
      </div>

      <div class="voli-suggestion-bar">
        <strong>Sugerencia:</strong> Pregúntame sobre «Voluntariados y ONGs»
      </div>

      <div class="voli-chat-body" id="voliChatBody">
        <div class="voli-msg-row bot">
          <div class="voli-msg-avatar">🤖</div>
          <div>
            <div class="voli-msg-bubble">
              ¡Hola! 👋 Soy <strong>TeAyudoIA</strong>, tu asistente en VoluntariApp. ¿Cómo puedo ayudarte hoy?
            </div>
            <div class="voli-msg-time">12:22</div>
            
            <div class="voli-chips-container" id="voliChips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              ${chipsHTML}
            </div>
          </div>
        </div>
      </div>

      <div class="voli-chat-footer">
        <div class="voli-input-box">
          <input type="text" id="voliInput" placeholder="Escribe tu pregunta...">
        </div>
        <button id="voliSendBtn" class="voli-send-btn">➤</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", botHTML);

  // Referencias DOM
  const toggleBtn = document.getElementById("voliToggleBtn");
  const closeBtn = document.getElementById("voliCloseBtn");
  const modal = document.getElementById("voliChatModal");
  const badge = document.getElementById("voliBadge");
  const sendBtn = document.getElementById("voliSendBtn");
  const input = document.getElementById("voliInput");
  const chatBody = document.getElementById("voliChatBody");
  const resetBtn = document.getElementById("voliResetBtn");

  // Cargar historial previo de la sesión actual si existe
  const historialGuardado = JSON.parse(sessionStorage.getItem(claveSesion) || "[]");
  if (historialGuardado.length > 0) {
    chatBody.innerHTML = ""; // Limpiamos el saludo inicial por defecto si hay historial guardado
    historialGuardado.forEach(msg => {
      agregarMensajeUI(msg.remitente, msg.texto, msg.hora, false);
    });
  }

  // Alternar apertura/cierre
  function toggleChat() {
    modal.classList.toggle("hidden");
    if (!modal.classList.contains("hidden")) {
      badge.textContent = "✕";
    } else {
      badge.textContent = "?";
    }
  }

  toggleBtn.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  // Botón para reiniciar / limpiar chat y memoria de la sesión
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      sessionStorage.removeItem(claveSesion);
      chatBody.innerHTML = `
        <div class="voli-msg-row bot">
          <div class="voli-msg-avatar">🤖</div>
          <div>
            <div class="voli-msg-bubble">
              ¡Chat reiniciado! ¿En qué puedo ayudarte ahora?
            </div>
            <div class="voli-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="voli-chips-container" id="voliChips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              ${chipsHTML}
            </div>
          </div>
        </div>
      `;
    });
  }

  // Activar botón de enviar cuando hay texto
  input.addEventListener("input", () => {
    if (input.value.trim().length > 0) {
      sendBtn.classList.add("active");
    } else {
      sendBtn.classList.remove("active");
    }
  });

  // Enviar mensaje al presionar Enter
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !input.disabled) enviarMensaje();
  });

  sendBtn.addEventListener("click", () => {
    if (!sendBtn.disabled) enviarMensaje();
  });

  async function enviarMensaje() {
    const texto = input.value.trim();
    if (!texto) return;

    // Agregar mensaje del usuario en el chat
    agregarMensajeUI("user", texto);
    input.value = "";
    sendBtn.classList.remove("active");

    // Bloquear controles mientras la IA está respondiendo
    input.disabled = true;
    sendBtn.disabled = true;

    // 1. MOSTRAR INDICADOR DE ESCRITURA ("Escribiendo...")
    const idEscritura = mostrarIndicadorEscritura();

    // Petición al Backend
    try {
      const res = await fetch((["localhost", "127.0.0.1"].includes(location.hostname) ? "http://127.0.0.1:8000" : "https://voluntariapp-1.onrender.com") + "/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          mensaje: texto,
          vista: esVistaOng ? "ong" : "voluntario" // enviamos la vista actual al backend
        }),
      });

      const data = await res.json();
      
      // 2. REMOVER EL INDICADOR DE ESCRITURA
      removerIndicadorEscritura(idEscritura);

      // Limpiamos cualquier asterisco o formato markdown residual de la respuesta
      const textoLimpio = limpiarMarkdown(data.respuesta || data.error || "No pude procesar tu solicitud.");
      agregarMensajeUI("bot", textoLimpio);
      
    } catch (err) {
      // 3. REMOVER EL INDICADOR EN CASO DE ERROR TAMBIÉN
      removerIndicadorEscritura(idEscritura);
      agregarMensajeUI("bot", "Ocurrió un error al conectar con TeAyudoIA. Inténtalo más tarde.");
    } finally {
      // Habilitar nuevamente los controles al finalizar la respuesta
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // Funciones para manejar la burbuja de "Escribiendo..."
  function mostrarIndicadorEscritura() {
    const idUnico = "typing-" + Date.now();
    const row = document.createElement("div");
    row.className = "voli-msg-row bot";
    row.id = idUnico;

    row.innerHTML = `
      <div class="voli-msg-avatar">🤖</div>
      <div>
        <div class="voli-msg-bubble" style="color: #666; font-style: italic; display: flex; align-items: center; gap: 4px;">
          TeAyudoIA está escribiendo
          <span class="dot-flashing" style="display:inline-flex; gap:2px;">
            <span style="animation: blink 1.4s infinite both;">.</span>
            <span style="animation: blink 1.4s infinite both .2s;">.</span>
            <span style="animation: blink 1.4s infinite both .4s;">.</span>
          </span>
        </div>
      </div>
    `;

    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
    return idUnico;
  }

  function removerIndicadorEscritura(idUnico) {
    const elemento = document.getElementById(idUnico);
    if (elemento) {
      elemento.remove();
    }
  }

  // Función para remover asteriscos y limpiar formato Markdown no deseado
  function limpiarMarkdown(texto) {
    if (!texto) return "";
    return texto.replace(/\*\*/g, "").replace(/\*/g, "").trim();
  }

  function agregarMensajeUI(remitente, texto, horaPersonalizada = null, guardar = true) {
    const hora = horaPersonalizada || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const row = document.createElement("div");
    row.className = `voli-msg-row ${remitente}`;

    if (remitente === "bot") {
      row.innerHTML = `
        <div class="voli-msg-avatar">🤖</div>
        <div>
          <div class="voli-msg-bubble">${texto}</div>
          <div class="voli-msg-time">${hora}</div>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div>
          <div class="voli-msg-bubble">${texto}</div>
          <div class="voli-msg-time" style="text-align:right;">${hora}</div>
        </div>
      `;
    }

    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Guardar en sessionStorage correspondiente a la sección si procede
    if (guardar) {
      const historialChat = JSON.parse(sessionStorage.getItem(claveSesion) || "[]");
      historialChat.push({ remitente, texto, hora });
      sessionStorage.setItem(claveSesion, JSON.stringify(historialChat));
    }
  }

  // Función global para los chips
  window.enviarPreguntaRapida = function(pregunta) {
    if (input.disabled) return;
    input.value = pregunta;
    enviarMensaje();
  };
});