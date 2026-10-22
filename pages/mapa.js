// mapa.js — Mapa público de convocatorias con Leaflet + OSM
// Conectado a la API de Django (Supabase)
// Participar ("Quiero participar") exige sesión de voluntario.

const CABA_CENTER = [-34.6037, -58.3816];
const CATEGORIA_LABELS = {
  'desarrollo-social': 'Desarrollo social',
  'salud': 'Salud',
  'educacion': 'Educación',
  'medioambiente': 'Medioambiente',
  'infancias': 'Infancias y juventudes',
  'derechos': 'Derechos humanos',
};
const CATEGORIA_ESTILOS = {
  'salud': { emoji: '🚑', iconBg: '#c0392b' },
  'infancias': { emoji: '👶', iconBg: '#2471a3' },
  'medioambiente': { emoji: '🌿', iconBg: '#1e8449' },
  'desarrollo-social': { emoji: '🤲', iconBg: '#ca6f1e' },
  'educacion': { emoji: '📚', iconBg: '#7d3c98' },
  'derechos': { emoji: '🕊️', iconBg: '#2471a3' },
};

function normalizarCategoria(causa) {
  if (!causa) return 'desarrollo-social';
  const c = causa.toLowerCase();
  if (c.includes('salud')) return 'salud';
  if (c.includes('educa')) return 'educacion';
  if (c.includes('ambiente') || c.includes('animal') || c.includes('ecolog')) return 'medioambiente';
  if (c.includes('infan') || c.includes('niñ') || c.includes('joven')) return 'infancias';
  if (c.includes('derecho') || c.includes('human')) return 'derechos';
  return 'desarrollo-social';
}

const state = {
  search: "",
  categoria: "todas",
  maxDistancia: 0,
  selectedId: null,
  items: [],
  isLoading: true,
  error: null,
};

function haversineKm(a, b, c, d) {
  const R = 6371;
  const dLat = ((c - a) * Math.PI) / 180;
  const dLng = ((d - b) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem('va_session') || 'null');
  } catch {
    return null;
  }
}

function getMyParticipations() {
  try {
    return JSON.parse(localStorage.getItem('va_parts_demo') || '[]');
  } catch {
    return [];
  }
}

// Acepta participaciones viejas (solo id) y nuevas (ficha con datos)
function parteId(p) {
  return String(typeof p === 'string' ? p : p.id);
}

function yaParticipa(id) {
  return getMyParticipations().some((p) => parteId(p) === String(id));
}

function guardarParticipacion(item) {
  const parts = getMyParticipations().filter((p) => parteId(p) !== String(item.id));
  parts.push({
    id: String(item.id),
    nombre: item.nombre,
    barrio: item.barrio,
    fecha: new Date().toISOString(),
  });
  localStorage.setItem('va_parts_demo', JSON.stringify(parts));
}

// ---- Toast no bloqueante (reemplazo de alert()) ----
function toast(msg, type = '') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast show ${type}`.trim();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---- Carga de datos: API de Django (Supabase) con manejo de errores ----
async function loadItems() {
  state.isLoading = true;
  state.error = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);

    const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
    const res = await fetch(`${baseUrl}/api/convocatorias/`, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`El servidor respondió con código ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      state.items = data.map(mapApiItem);
      state.isLoading = false;
      return;
    }
    throw new Error('Respuesta inválida');
  } catch (err) {
    console.error('Error al cargar convocatorias:', err);
    state.items = [];
    state.isLoading = false;
    state.error = 'No pudimos cargar las convocatorias desde el servidor.';
    toast('No pudimos conectar con el servidor. Reintentá nuevamente.', 'error');
  }
}

// Adaptador: traduce las columnas de vista_convocatorias_cards al formato del mapa
function mapApiItem(c) {
  const cat = normalizarCategoria(c.causa_nombre || c.categoria);
  const estilo = CATEGORIA_ESTILOS[cat] || { emoji: '🤝', iconBg: '#1A7A5E' };
  const lat = parseFloat(c.latitud ?? c.lat) || CABA_CENTER[0];
  const lng = parseFloat(c.longitud ?? c.lng) || CABA_CENTER[1];

  return {
    id: c.convocatoria_id || c.id,
    nombre: c.nombre_organizacion ? `${c.nombre_organizacion} — ${c.titulo}` : (c.titulo || 'Convocatoria'),
    barrio: [c.localidad_nombre, c.provincia_nombre].filter(Boolean).join(', ') || c.lugar || c.direccion || '',
    categoria: cat,
    emoji: estilo.emoji,
    iconBg: estilo.iconBg,
    lat: lat,
    lng: lng,
    voluntarios: c.voluntarios ?? 0,
    rating: parseFloat(c.ong_rating || 5.0),
    distancia: haversineKm(CABA_CENTER[0], CABA_CENTER[1], lat, lng),
    cupos: c.cupos_totales ?? c.cupos_disponibles ?? c.cupos ?? 0,
    verificada: c.ong_verificada ?? true,
    web: c.web || '',
    linkPago: c.ong_link_donacion || '',
    contacto: c.direccion || c.lugar || '',
    descripcion: c.descripcion || '',
    necesidades: c.necesidades || '',
  };
}

// ---- Mapa Leaflet ----
const map = L.map("map").setView(CABA_CENTER, 12);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

function makeIcon(item, active) {
  return L.divIcon({
    className: "custom-pin-wrapper",
    html: `<div class="custom-pin ${active ? "active" : ""}"><span style="background:${item.iconBg}"><i>${item.emoji}</i></span></div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -40],
  });
}

const markersById = {};

function getFiltered() {
  return state.items.filter((o) => {
    const q = state.search.toLowerCase();
    const matchSearch =
      !q || o.nombre.toLowerCase().includes(q) || o.barrio.toLowerCase().includes(q);
    const matchCat = state.categoria === "todas" || o.categoria === state.categoria;
    const matchDist = !state.maxDistancia || o.distancia <= state.maxDistancia;
    return matchSearch && matchCat && matchDist;
  });
}

function reviewBadge(o) {
  return o.verificada ? '' : '<span class="review-badge">En revisión</span>';
}

function renderMarkers(list) {
  Object.values(markersById).forEach((m) => map.removeLayer(m));
  for (const k of Object.keys(markersById)) delete markersById[k];

  list.forEach((item) => {
    const marker = L.marker([item.lat, item.lng], {
      icon: makeIcon(item, item.id === state.selectedId),
    }).addTo(map);

    marker.bindPopup(`
      <strong>${item.emoji} ${item.nombre}</strong><br>
      📍 ${item.barrio}<br>
      ⭐ ${item.rating} &nbsp;·&nbsp; 👥 ${item.voluntarios} vol.<br>
      <span class="popup-cupos">🤝 ${item.cupos} cupos</span>
    `);

    marker.on("click", () => selectItem(item.id, false));
    markersById[item.id] = marker;
  });
}

function renderList(list) {
  const container = document.getElementById("ong-list");
  const countEl = document.getElementById("results-count");
  const statConvs = document.getElementById("stat-convs");
  const statCupos = document.getElementById("stat-cupos");

  if (state.isLoading) {
    if (countEl) countEl.textContent = "Cargando...";
    if (statConvs) statConvs.textContent = "--";
    if (statCupos) statCupos.textContent = "--";
    container.innerHTML = `
      <div style="padding: 40px 18px; text-align: center; color: #5A7A72;">
        <p style="font-size: 26px; margin-bottom: 8px;">⏳</p>
        <p style="font-size: 15px; font-weight: 600;">Cargando...</p>
      </div>`;
    return;
  }

  if (state.error) {
    if (countEl) countEl.textContent = "Error al conectar";
    if (statConvs) statConvs.textContent = "0";
    if (statCupos) statCupos.textContent = "0";
    container.innerHTML = `
      <div style="padding: 32px 18px; text-align: center;">
        <p style="font-size: 30px; margin-bottom: 10px;">⚠️</p>
        <p style="font-size: 15px; font-weight: 700; color: #c0392b; margin-bottom: 6px;">No se pudieron cargar las convocatorias</p>
        <p style="font-size: 13px; color: #5A7A72; margin-bottom: 16px;">Hubo un problema al conectar con el servidor.</p>
        <button id="btn-reintentar" class="btn-primary" style="padding: 8px 20px; font-size: 13px; border-radius: 9999px; cursor: pointer;">
          ↻ Reintentar
        </button>
      </div>`;

    container.querySelector("#btn-reintentar")?.addEventListener("click", async () => {
      state.isLoading = true;
      state.error = null;
      refresh(false);
      await loadItems();
      refresh(false);
    });
    return;
  }

  if (countEl) countEl.textContent =
    `${list.length} convocatoria${list.length === 1 ? '' : 's'} abierta${list.length === 1 ? '' : 's'}`;
  if (statConvs) statConvs.textContent = list.length;
  if (statCupos) statCupos.textContent = list.reduce((acc, o) => acc + o.cupos, 0);

  if (!list.length) {
    container.innerHTML = `<p style="padding:18px;font-size:14px;color:#5A7A72">Sin resultados. Probá con otra búsqueda o filtro.</p>`;
    return;
  }

  container.innerHTML = list
    .map(
      (o) => `
    <article class="ong-card ${o.id === state.selectedId ? "active" : ""}" data-id="${o.id}">
      <div class="ong-emoji">${o.emoji}</div>
      <div class="ong-info">
        <h3 class="ong-name">${o.nombre} ${reviewBadge(o)}</h3>
        <p class="ong-barrio">📍 ${o.barrio}</p>
        <div class="ong-meta"><span>👥 ${o.voluntarios}</span><span class="rating">★ ${o.rating}</span></div>
        <p class="ong-dist">➤ ${o.distancia.toFixed(1)} km</p>
        <span class="ong-cupos">🤝 ${o.cupos} cupos</span>
      </div>
      <span class="ong-arrow">›</span>
    </article>`
    )
    .join("");

  container.querySelectorAll(".ong-card").forEach((card) => {
    card.addEventListener("click", () => selectItem(card.dataset.id, true));
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeLink(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function renderDetail() {
  const detail = document.getElementById("ong-detail");
  const item = state.items.find((o) => String(o.id) === String(state.selectedId));
  if (!item) {
    detail.classList.add("hidden");
    detail.innerHTML = "";
    return;
  }

  const session = getSession();
  const alreadyIn = yaParticipa(item.id);
  const sinCupos = item.cupos <= 0;

  let btnHtml;
  if (sinCupos) {
    btnHtml = `<button class="btn-primary" disabled>Sin cupos por ahora</button>`;
  } else if (alreadyIn) {
    btnHtml = `<button class="btn-primary" disabled>Ya estás participando ✓</button>`;
  } else {
    btnHtml = `<button class="btn-primary" id="detail-join">Quiero participar</button>`;
  }

  const web = safeLink(item.web);
  const pago = safeLink(item.linkPago);
  const links = [
    web ? `<a class="detail-link" href="${esc(web)}" target="_blank" rel="noopener">🌐 Visitar sitio de la ONG</a>` : '',
    pago ? `<a class="detail-link" href="${esc(pago)}" target="_blank" rel="noopener">💳 Donar a esta causa</a>` : '',
    item.contacto ? `<span class="detail-row">✉️ Contacto: <strong>${esc(item.contacto)}</strong></span>` : '',
  ].filter(Boolean).join('');

  detail.classList.remove("hidden");
  detail.innerHTML = `
    <button class="detail-back" id="detail-back">← Volver</button>
    <span class="detail-category">${esc(CATEGORIA_LABELS[item.categoria] || item.categoria)}</span>
    <h2>${item.emoji} ${esc(item.nombre)} ${reviewBadge(item)}</h2>
    <p class="detail-desc">${esc(item.descripcion)}</p>
    ${item.necesidades ? `<p class="detail-row">🙌 Buscan: <strong>${esc(item.necesidades)}</strong></p>` : ''}
    <p class="detail-row">📍 <strong>${esc(item.barrio)}</strong></p>
    <p class="detail-row">⭐ ${item.rating} &nbsp;·&nbsp; 👥 ${item.voluntarios} voluntarios &nbsp;·&nbsp; ➤ ${item.distancia.toFixed(1)} km</p>
    <p class="detail-row">🤝 <strong>${item.cupos} cupos disponibles</strong></p>
    ${links ? `<div class="detail-links">${links}</div>` : ''}
    <div class="detail-actions">
      ${btnHtml}
      <button class="btn-secondary" id="detail-center">Ver en mapa</button>
    </div>`;

  document.getElementById("detail-back").addEventListener("click", () => {
    state.selectedId = null;
    refresh(false);
  });
  document.getElementById("detail-center").addEventListener("click", () => {
    map.flyTo([item.lat, item.lng], 15, { duration: 0.8 });
    markersById[item.id]?.openPopup();
  });
  document.getElementById("detail-join")?.addEventListener("click", () => joinConvocatoria(item));
}

async function joinConvocatoria(item) {
  const session = getSession();
  if (!session) {
    window.location.href = `login.html?next=mapa.html&conv=${encodeURIComponent(item.id)}`;
    return;
  }
  if (session.rol === 'ong') {
    toast('Las participaciones son para cuentas de voluntarios.', 'error');
    return;
  }

  // Intento contra la API
  const token = sessionStorage.getItem('va_token');
  if (token) {
    try {
      const res = await fetch(`/api/convocatorias/${encodeURIComponent(item.id)}/participar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        item.cupos = Math.max(0, item.cupos - 1);
        guardarParticipacion(item);
        toast('¡Listo! Ya estás participando en esta convocatoria.', 'success');
        refresh(false);
        return;
      }
      if (res.status === 409) {
        toast('Ya estás participando en esta convocatoria.', 'error');
        return;
      }
      throw new Error(data.message || 'Error del servidor');
    } catch (err) {
      if (!(err instanceof TypeError)) {
        toast(err.message || 'No se pudo registrar tu participación.', 'error');
        return;
      }
    }
  }

  // Modo demo (sin backend)
  if (yaParticipa(item.id)) {
    toast('Ya estás participando en esta convocatoria.', 'error');
    return;
  }
  if (item.cupos <= 0) {
    toast('Esta convocatoria ya no tiene cupos.', 'error');
    return;
  }
  guardarParticipacion(item);
  item.cupos = Math.max(0, item.cupos - 1);
  toast('¡Listo! Ya estás participando en esta convocatoria.', 'success');
  refresh(false);
}

function selectItem(id, openPopup) {
  state.selectedId = id;
  const item = state.items.find((o) => String(o.id) === String(id));
  refresh(false);
  if (item) {
    map.flyTo([item.lat, item.lng], 14, { duration: 0.8 });
    if (openPopup !== false) markersById[id]?.openPopup();
  }
}

function refresh(fitBounds = false) {
  const list = getFiltered();
  renderMarkers(list);
  renderList(list);
  renderDetail();
  if (fitBounds && list.length) {
    map.flyToBounds(L.latLngBounds(list.map((o) => [o.lat, o.lng])), { padding: [40, 40], duration: 0.6 });
  }
}

// ---- Header según sesión (mapa público: invitado o logueado) ----
const PANEL_POR_ROL = {
  voluntario: { href: 'participaciones.html', texto: 'Mis participaciones' },
  ong: { href: 'mi-ong.html', texto: 'Mi ONG' },
  admin: { href: 'admin.html', texto: 'Administración' },
};

function renderHeader() {
  const session = getSession();
  const guest = document.getElementById('guest-actions');
  const userArea = document.getElementById('user-area');
  const logout = document.getElementById('logout-link');
  const panel = document.getElementById('panel-link');

  if (session) {
    guest?.classList.add('hidden');
    userArea?.classList.remove('hidden');
    logout?.classList.remove('hidden');
    const dest = PANEL_POR_ROL[session.rol] || PANEL_POR_ROL.voluntario;
    if (panel) {
      panel.href = dest.href;
      panel.textContent = dest.texto;
      panel.classList.remove('hidden');
    }
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = session.nombre || session.email;
    if (avatarEl) avatarEl.textContent = ((session.nombre || session.email || 'V')[0] || 'V').toUpperCase();
  } else {
    guest?.classList.remove('hidden');
    userArea?.classList.add('hidden');
    logout?.classList.add('hidden');
    panel?.classList.add('hidden');
  }
}

document.getElementById('logout-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  sessionStorage.removeItem('va_token');
  sessionStorage.removeItem('va_session');
  renderHeader();
  toast('Sesión cerrada. El mapa sigue disponible para explorar.');
  setTimeout(() => { window.location.href = '../index.html'; }, 600);
});

// ---- Eventos de filtros ----
document.getElementById("search-input").addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  refresh(false);
});

const categoryBtn = document.getElementById("filter-category-btn");
const categorySelect = document.getElementById("category-select");
categoryBtn.addEventListener("click", () => {
  categorySelect.showPicker ? categorySelect.showPicker() : categorySelect.focus();
});
categorySelect.addEventListener("change", (e) => {
  state.categoria = e.target.value;
  document.getElementById("filter-category-label").textContent =
    e.target.options[e.target.selectedIndex].text;
  refresh(true);
});

const distanceBtn = document.getElementById("distance-btn");
const distanceSelect = document.getElementById("distance-select");
distanceBtn.addEventListener("click", () => {
  distanceSelect.showPicker ? distanceSelect.showPicker() : distanceSelect.focus();
});
distanceSelect.addEventListener("change", (e) => {
  state.maxDistancia = Number(e.target.value);
  document.getElementById("distance-label").textContent =
    e.target.options[e.target.selectedIndex].text;
  refresh(true);
});

document.getElementById("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    toast('Tu navegador no soporta geolocalización.', 'error');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup("📍 Estás aquí")
        .openPopup();
      map.flyTo([latitude, longitude], 13, { duration: 0.8 });
    },
    () => toast('No se pudo obtener tu ubicación.', 'error'),
    { enableHighAccuracy: true }
  );
});

// Sidebar mobile
const sidebar = document.getElementById("ong-sidebar");
document.getElementById("sidebar-close").addEventListener("click", () => sidebar.classList.remove("open"));
document.getElementById("fab-list").addEventListener("click", () => sidebar.classList.toggle("open"));
if (window.innerWidth > 900) sidebar.classList.add("open");

// Inicio: header + datos reales (API) + retorno ?conv=
(async function init() {
  renderHeader();
  refresh(false); // Muestra estado de carga de inmediato
  await loadItems();
  refresh(false);
  const convId = new URLSearchParams(window.location.search).get('conv');
  if (convId && state.items.some((o) => String(o.id) === String(convId))) {
    selectItem(convId, true);
    if (window.innerWidth <= 900) sidebar.classList.add("open");
  }
})();
