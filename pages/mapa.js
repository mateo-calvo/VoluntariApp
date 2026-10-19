// mapa.js — Mapa público de convocatorias con Leaflet + OSM
// Fuente primaria: API (server/). Fallback demo: seed local + ONGs de va_ongs_demo.
// Participar ("Quiero participar") exige sesión de voluntario.

const SEED = [
  { id: 1, nombre: "Cruz Roja Argentina — Palermo", barrio: "Palermo, CABA", categoria: "salud", emoji: "🚑", iconBg: "#c0392b", lat: -34.5731, lng: -58.422, voluntarios: 541, rating: 4.9, distancia: 4.8, cupos: 12, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Atención en emergencias, primeros auxilios y campañas de donación de sangre en Palermo.", necesidades: "Primeros auxilios, logística" },
  { id: 2, nombre: "UNICEF Argentina — Recoleta", barrio: "Recoleta, CABA", categoria: "infancias", emoji: "👶", iconBg: "#2471a3", lat: -34.5884, lng: -58.393, voluntarios: 312, rating: 4.8, distancia: 2.0, cupos: 8, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Programas de infancia, educación y protección de derechos de niños y adolescentes.", necesidades: "Apoyo escolar, difusión" },
  { id: 3, nombre: "Greenpeace Argentina — San Telmo", barrio: "San Telmo, CABA", categoria: "medioambiente", emoji: "🌿", iconBg: "#1e8449", lat: -34.6214, lng: -58.3735, voluntarios: 189, rating: 4.7, distancia: 2.1, cupos: 5, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Activismo ambiental, limpieza de espacios verdes y concientización climática.", necesidades: "Limpiezas, concientización" },
  { id: 4, nombre: "Cáritas Buenos Aires — Flores", barrio: "Flores, CABA", categoria: "desarrollo-social", emoji: "🤲", iconBg: "#ca6f1e", lat: -34.629, lng: -58.459, voluntarios: 423, rating: 4.9, distancia: 8.2, cupos: 15, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Apoyo alimentario, ropero comunitario y acompañamiento a familias vulnerables.", necesidades: "Cocina, ropero, acompañamiento" },
  { id: 5, nombre: "Banco de Alimentos — La Boca", barrio: "La Boca, CABA", categoria: "desarrollo-social", emoji: "🍎", iconBg: "#cb4335", lat: -34.6345, lng: -58.3632, voluntarios: 298, rating: 4.8, distancia: 4.0, cupos: 20, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Recuperación y distribución de alimentos a comedores y merenderos.", necesidades: "Clasificación, reparto" },
  { id: 6, nombre: "Médicos Sin Fronteras — Barracas", barrio: "Barracas, CABA", categoria: "salud", emoji: "💊", iconBg: "#c0392b", lat: -34.6475, lng: -58.3853, voluntarios: 210, rating: 4.8, distancia: 5.3, cupos: 7, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Atención médica humanitaria y operativos de salud barriales.", necesidades: "Salud, administración" },
  { id: 7, nombre: "Fundación Sí — Belgrano", barrio: "Belgrano, CABA", categoria: "desarrollo-social", emoji: "🏠", iconBg: "#ca6f1e", lat: -34.5627, lng: -58.4568, voluntarios: 176, rating: 4.7, distancia: 6.5, cupos: 10, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Inclusión social, residencias universitarias y recorridas nocturnas.", necesidades: "Recorridas, cocina" },
  { id: 8, nombre: "TECHO Argentina — Villa Crespo", barrio: "Villa Crespo, CABA", categoria: "desarrollo-social", emoji: "🏡", iconBg: "#1A7A5E", lat: -34.599, lng: -58.445, voluntarios: 342, rating: 4.9, distancia: 3.4, cupos: 18, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Construcción de viviendas de emergencia junto a familias de barrios populares.", necesidades: "Construcción, relevamiento" },
  { id: 9, nombre: "Educar 2050 — Retiro", barrio: "Retiro, CABA", categoria: "educacion", emoji: "📚", iconBg: "#7d3c98", lat: -34.5917, lng: -58.3731, voluntarios: 154, rating: 4.6, distancia: 1.5, cupos: 6, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Apoyo escolar, tutorías y programas de terminalidad educativa.", necesidades: "Tutorías" },
  { id: 10, nombre: "Amnistía Internacional — Puerto Madero", barrio: "Puerto Madero, CABA", categoria: "derechos", emoji: "🕊️", iconBg: "#2471a3", lat: -34.6083, lng: -58.3625, voluntarios: 132, rating: 4.7, distancia: 3.0, cupos: 4, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Defensa de derechos humanos, investigación y campañas globales.", necesidades: "Investigación, firmas" },
  { id: 11, nombre: "Fundación Huella — La Boca Sur", barrio: "La Boca, CABA", categoria: "medioambiente", emoji: "🐾", iconBg: "#1e8449", lat: -34.6275, lng: -58.358, voluntarios: 98, rating: 4.5, distancia: 4.6, cupos: 9, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Rescate animal, castraciones y adopción responsable.", necesidades: "Tránsito, traslados" },
  { id: 12, nombre: "Sonrisas Solidarias — Flores Sur", barrio: "Flores Sur, CABA", categoria: "infancias", emoji: "🧸", iconBg: "#7d3c98", lat: -34.645, lng: -58.445, voluntarios: 121, rating: 4.6, distancia: 9.1, cupos: 11, verificada: true, web: "", linkPago: "", contacto: "", descripcion: "Jornadas lúdicas y apoyo a comedores infantiles los fines de semana.", necesidades: "Juegos, cocina" },
];

const CABA_CENTER = [-34.6037, -58.3816];
const CATEGORIA_LABELS = {
  'desarrollo-social': 'Desarrollo social',
  'salud': 'Salud',
  'educacion': 'Educación',
  'medioambiente': 'Medioambiente',
  'infancias': 'Infancias y juventudes',
  'derechos': 'Derechos humanos',
};
const state = { search: "", categoria: "todas", maxDistancia: 0, selectedId: null, items: [...SEED] };

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

// ---- Carga de datos: API primero, demo local como respaldo ----
async function loadItems() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('/api/convocatorias', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('API no disponible');
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      state.items = data.map(mapApiItem);
      return;
    }
    throw new Error('Sin datos');
  } catch {
    state.items = [...SEED, ...loadDemoOngs()];
  }
}

function mapApiItem(c) {
  const ong = c.ong || {};
  return {
    id: c._id || c.id,
    nombre: c.titulo || ong.nombrePublico || 'Convocatoria',
    barrio: c.barrio || ong.barrio || '',
    categoria: c.categoria || ong.categoria || 'desarrollo-social',
    emoji: c.emoji || '🤝',
    iconBg: c.iconBg || '#1A7A5E',
    lat: c.lat ?? ong.lat ?? CABA_CENTER[0],
    lng: c.lng ?? ong.lng ?? CABA_CENTER[1],
    voluntarios: c.voluntarios ?? 0,
    rating: c.rating ?? 5.0,
    distancia: haversineKm(CABA_CENTER[0], CABA_CENTER[1], c.lat ?? CABA_CENTER[0], c.lng ?? CABA_CENTER[1]),
    cupos: c.cuposDisponibles ?? c.cupos ?? 0,
    verificada: ong.verificada ?? true,
    web: ong.web || c.web || '',
    linkPago: ong.linkPago || '',
    contacto: ong.contacto || '',
    descripcion: c.descripcion || ong.descripcion || '',
    necesidades: c.necesidades || ong.necesidades || '',
  };
}

// ONGs registradas en modo demo (register sin backend)
function loadDemoOngs() {
  try {
    const ongs = JSON.parse(localStorage.getItem('va_ongs_demo') || '[]');
    return ongs
      .filter((o) => o.estado !== 'rechazada')
      .map((o, i) => ({
        id: `demo-${i}-${(o.cuit || i).toString().replace(/\D/g, '')}`,
        nombre: o.nombrePublico || o.razonSocial,
        barrio: o.barrio,
        categoria: o.categoria || 'desarrollo-social',
        emoji: '🏢',
        iconBg: '#1A7A5E',
        lat: o.lat ?? CABA_CENTER[0],
        lng: o.lng ?? CABA_CENTER[1],
        voluntarios: 0,
        rating: 5.0,
        distancia: haversineKm(CABA_CENTER[0], CABA_CENTER[1], o.lat ?? CABA_CENTER[0], o.lng ?? CABA_CENTER[1]),
        cupos: o.cupos ?? 5,
        verificada: o.verificada === true,
        web: o.web || '',
        linkPago: o.linkPago || '',
        contacto: o.contacto || '',
        descripcion: o.descripcion || '',
        necesidades: o.necesidades || '',
      }));
  } catch {
    return [];
  }
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
  document.getElementById("results-count").textContent =
    `${list.length} convocatoria${list.length === 1 ? '' : 's'} abierta${list.length === 1 ? '' : 's'}`;
  document.getElementById("stat-convs").textContent = list.length;
  document.getElementById("stat-cupos").textContent = list.reduce((acc, o) => acc + o.cupos, 0);

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

// Inicio: header + datos (API o demo) + retorno ?conv=
(async function init() {
  renderHeader();
  await loadItems();
  refresh(false);
  const convId = new URLSearchParams(window.location.search).get('conv');
  if (convId && state.items.some((o) => String(o.id) === String(convId))) {
    selectItem(convId, true);
    if (window.innerWidth <= 900) sidebar.classList.add("open");
  }
})();
