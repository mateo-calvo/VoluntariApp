document.addEventListener("DOMContentLoaded", () => {
  // Inyección automática del HTML del Chat con preguntas rápidas actualizadas para ONGs y Voluntarios
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
            
            <div class="voli-chips-container" id="voliChips">
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo publicar una convocatoria?')">¿Cómo publicar convocatoria?</button>
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo me postulo a un voluntariado?')">¿Cómo postularme?</button>
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Qué requisitos piden las ONGs?')">Requisitos para ONGs</button>
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo contacto a una organización?')">Contactar ONG</button>
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

  // Manejo de almacenamiento independiente por sección (ONG vs Voluntario)
  const esVistaOng = window.location.pathname.includes('ong');
  const claveSesion = esVistaOng ? 'chat_historial_ong' : 'chat_historial_voluntario';

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
    if (e.key === "Enter") enviarMensaje();
  });

  sendBtn.addEventListener("click", enviarMensaje);

  async function enviarMensaje() {
    const texto = input.value.trim();
    if (!texto) return;

    // Agregar mensaje del usuario en el chat
    agregarMensajeUI("user", texto);
    input.value = "";
    sendBtn.classList.remove("active");

    // Petición al Backend
    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          mensaje: texto,
          vista: esVistaOng ? "ong" : "voluntario" // enviamos la vista actual al backend
        }),
      });

      const data = await res.json();
      
      // Limpiamos cualquier asterisco o formato markdown residual de la respuesta
      const textoLimpio = limpiarMarkdown(data.respuesta || data.error || "No pude procesar tu solicitud.");
      agregarMensajeUI("bot", textoLimpio);
      
    } catch (err) {
      agregarMensajeUI("bot", "Ocurrió un error al conectar con TeAyudoIA. Inténtalo más tarde.");
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
    input.value = pregunta;
    enviarMensaje();
  };
});