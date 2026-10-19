document.addEventListener("DOMContentLoaded", () => {
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
              ¡Hola! 👋 Soy <strong>TeAyudoIA</strong>, el asistente de VoluntariApp. Estoy aquí para guiarte. ¿En qué puedo ayudarte?
            </div>
            <div class="voli-msg-time">12:22</div>
            
            <div class="voli-chips-container" id="voliChips">
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Qué es VoluntariApp?')">¿Qué es VoluntariApp?</button>
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo me registro?')">¿Cómo me registro?</button>
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo funciona el mapa?')">¿Cómo funciona el mapa?</button>
              <button class="voli-chip" onclick="enviarPreguntaRapida('¿Cómo dono?')">¿Cómo dono?</button>
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
      const res = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: texto }),
      });

      const data = await res.json();
      agregarMensajeUI("bot", data.respuesta || "No pude procesar tu solicitud.");
    } catch (err) {
      agregarMensajeUI("bot", "Ocurrió un error al conectar con TeAyudoIA. Inténtalo más tarde.");
    }
  }

  function agregarMensajeUI(remitente, texto) {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  }

  // Función global para los chips
  window.enviarPreguntaRapida = function(pregunta) {
    input.value = pregunta;
    enviarMensaje();
  };
});