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
  postulacionesMap: {},
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

// ---- Manejo de ubicación para Cuenta Demo ----
function getDemoOverrides() {
  let single = null;
  let list = [];
  try { single = JSON.parse(localStorage.getItem('va_demo_ong_override') || 'null'); } catch {}
  try { list = JSON.parse(localStorage.getItem('va_ongs_demo') || '[]'); } catch {}
  return { single, list };
}

function aplicarOverridesDemo() {
  const { single, list } = getDemoOverrides();
  const session = getSession();

  let override = single;
  if (!override && list.length > 0) {
    const found = list.find(o => session && (o.ownerEmail === session.email || o.email === session.email)) || list[0];
    if (found && found.barrio) {
      override = {
        nombre: found.nombrePublico || found.nombre,
        barrio: found.barrio,
        lat: found.lat,
        lng: found.lng,
        linkPago: found.linkPago,
        categoria: found.categoria
      };
    }
  }

  if (override && override.lat && override.lng) {
    const oLat = Number(override.lat);
    const oLng = Number(override.lng);
    state.items.forEach(item => {
      const isMatch = (
        (override.nombre && item.nombreOrganizacion && item.nombreOrganizacion.toLowerCase() === override.nombre.toLowerCase())
      );
      if (isMatch) {
        item.lat = oLat;
        item.lng = oLng;
        item.barrio = override.barrio || item.barrio;
        item.distancia = haversineKm(CABA_CENTER[0], CABA_CENTER[1], oLat, oLng);
        if (override.linkPago) item.linkPago = override.linkPago;
      }
    });
  }
}

// ---- Carga de datos: API de Django (Supabase) con manejo de errores ----
async function syncMisPostulaciones() {
  const token = sessionStorage.getItem('va_token');
  const session = getSession();
  if (!token || !session || session.rol !== 'voluntario') return;
  try {
    const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
    const res = await fetch(`${baseUrl}/api/voluntario/mis-postulaciones?estado=todas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const posts = await res.json();
      if (Array.isArray(posts)) {
        state.postulacionesMap = {};
        posts.forEach((p) => {
          state.postulacionesMap[String(p.convocatoria_id)] = p.estado;
        });
        const activas = posts.filter((p) => ['POSTULADO', 'CONFIRMADO'].includes(p.estado));
        const mapped = activas.map((p) => ({
          id: String(p.convocatoria_id),
          nombre: p.titulo_convocatoria,
          barrio: p.lugar || '',
          fecha: p.created_at,
        }));
        localStorage.setItem('va_parts_demo', JSON.stringify(mapped));
      }
    }
  } catch (e) {
    console.warn('No se pudo sincronizar mis postulaciones:', e);
  }
}

async function loadItems() {
  state.isLoading = true;
  state.error = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
    const res = await fetch(`${baseUrl}/api/convocatorias/`, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`El servidor respondió con código ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      await syncMisPostulaciones();
      state.items = data.map(mapApiItem);
      aplicarOverridesDemo();
      state.isLoading = false;
      return;
    }
    throw new Error('Respuesta inválida');
  } catch (err) {
    console.error('Error al cargar convocatorias:', err);
    state.items = [];
    aplicarOverridesDemo();
    state.isLoading = false;
    state.error = 'No pudimos cargar las convocatorias desde el servidor.';
    toast('No pudimos conectar con el servidor. Reintentá nuevamente.', 'error');
  }
}

// Adaptador: traduce las columnas de vista_convocatorias_mapa al formato del mapa
function mapApiItem(c) {
  const cat = normalizarCategoria(c.causa_nombre || c.categoria);
  const estilo = CATEGORIA_ESTILOS[cat] || { emoji: '🤝', iconBg: '#1A7A5E' };
  const lat = parseFloat(c.latitud ?? c.lat) || CABA_CENTER[0];
  const lng = parseFloat(c.longitud ?? c.lng) || CABA_CENTER[1];
  const id = c.convocatoria_id || c.id;
  const cuposTotales = parseInt(c.cupos_totales ?? c.cupos_disponibles ?? c.cupos ?? 0, 10) || 0;
  const inscriptosActuales = parseInt(c.inscriptos_actuales ?? 0, 10) || 0;
  const libresBase = c.lugares_libres != null ? parseInt(c.lugares_libres, 10) : Math.max(0, cuposTotales - inscriptosActuales);
  const yaIn = yaParticipa(id);
  const cuposRestantes = Math.max(0, libresBase - (yaIn ? 1 : 0));

  const dir = c.direccion || '';
  const barrio = c.localidad_nombre || '';
  let ubicacionConvocatoria = '';

  if (dir && barrio) {
    ubicacionConvocatoria = dir.toLowerCase().includes(barrio.toLowerCase()) ? dir : `${dir}, ${barrio}`;
  } else {
    ubicacionConvocatoria = dir || c.lugar || barrio || 'Buenos Aires';
  }

  return {
    id: id,
    nombreOrganizacion: c.nombre_organizacion || '',
    nombre: c.nombre_organizacion ? `${c.nombre_organizacion} — ${c.titulo}` : (c.titulo || 'Convocatoria'),
    barrio: ubicacionConvocatoria,
    lugar: c.lugar || '',
    direccion: c.direccion || '',
    localidad: c.localidad_nombre || '',
    provincia: c.provincia_nombre || '',
    categoria: cat,
    emoji: estilo.emoji,
    iconBg: estilo.iconBg,
    lat: lat,
    lng: lng,
    totalCupos: cuposTotales,
    inscriptos: inscriptosActuales + (yaIn ? 1 : 0),
    voluntarios: inscriptosActuales + (yaIn ? 1 : 0),
    rating: parseFloat(c.ong_rating || 5.0),
    distancia: haversineKm(CABA_CENTER[0], CABA_CENTER[1], lat, lng),
    cupos: c.cupos_totales ?? c.cupos_disponibles ?? c.cupos ?? 0,
    cupos: cuposRestantes,
    verificada: c.ong_verificada ?? true,
    web: c.web || '',
    linkPago: c.ong_link_donacion || '',
    contacto: c.ong_email_contacto || c.email_contacto || '',
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

    const yaIn = yaParticipa(item.id);
    const badgeHtml = yaIn ? `<div style="margin-top: 4px;"><span style="background: #27ae60; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 9999px; font-weight: 700; display: inline-block;">Participando ✓</span></div>` : '';

    marker.bindPopup(`
      <strong>${item.emoji} ${esc(item.nombre)}</strong><br>
      📍 ${esc(item.barrio)}<br>
      ⭐ ${item.rating} &nbsp;·&nbsp; 👥 ${item.totalCupos} cupos totales<br>
      <span class="popup-cupos">🤝 ${item.cupos} disponibles</span>
      ${badgeHtml}
      <div style="margin-top: 8px;">
        <button class="popup-detail-btn" data-id="${item.id}" type="button">Ver detalle completo →</button>
      </div>
    `);

    marker.on("popupopen", () => {
      const btn = document.querySelector(`.popup-detail-btn[data-id="${item.id}"]`);
      btn?.addEventListener("click", () => {
        selectItem(item.id, false);
      });
    });

    marker.on("click", () => {
      selectItem(item.id, false);
    });
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
      (o) => {
        const yaIn = yaParticipa(o.id);
        const postuladoBadge = yaIn ? `<span style="background:#27ae60; color:#fff; font-size:11px; padding:2px 8px; border-radius:9999px; font-weight:700; margin-left:6px; display:inline-block; vertical-align:middle;">Participando ✓</span>` : '';
        const cuposText = yaIn
          ? `<span class="ong-cupos" style="color:#27ae60; font-weight:700;">🤝 Ya estás anotado &nbsp;·&nbsp; ${o.cupos} lugares libres</span>`
          : `<span class="ong-cupos">🤝 ${o.cupos} lugares libres</span>`;

        return `
    <article class="ong-card ${o.id === state.selectedId ? "active" : ""}" data-id="${o.id}">
      <div class="ong-emoji">${o.emoji}</div>
      <div class="ong-info">
        <h3 class="ong-name">${o.nombre} ${reviewBadge(o)} ${postuladoBadge}</h3>
        <p class="ong-barrio">📍 ${o.barrio}</p>
        <div class="ong-meta"><span>👥 ${o.totalCupos} cupos totales</span><span class="rating">★ ${o.rating}</span></div>
        <p class="ong-dist">➤ ${o.distancia.toFixed(1)} km</p>
        ${cuposText}
      </div>
      <span class="ong-arrow">›</span>
    </article>`;
      }
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
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function obtenerLinkMercadoPago(url) {
  if (window.DonarONG && window.DonarONG.validarLink) {
    return window.DonarONG.validarLink(url);
  }
  const link = safeLink(url);
  if (!link) return null;
  const lower = link.toLowerCase();
  if (lower.includes('mercadopago') || lower.includes('mpago.la') || lower.includes('mpago.li')) {
    return link;
  }
  return null;
}

function renderDetail() {
  const detail = document.getElementById("ong-detail");
  const item = state.items.find((o) => String(o.id) === String(state.selectedId));
  if (!item) {
    detail.classList.add("hidden");
    sidebar?.classList.remove("detail-open");
    document.body.classList.remove("detail-open");
    detail.innerHTML = "";
    return;
  }

  sidebar?.classList.add("detail-open");
  document.body.classList.add("detail-open");

  const session = getSession();
  const estadoPost = state.postulacionesMap ? state.postulacionesMap[String(item.id)] : null;
  const alreadyIn = yaParticipa(item.id) || ['POSTULADO', 'CONFIRMADO'].includes(estadoPost);
  const isCancelado = estadoPost === 'CANCELADO';
  const isFinalizado = ['ASISTIO', 'FINALIZADO'].includes(estadoPost);
  const sinCupos = item.cupos <= 0;

  let btnHtml;
  if (alreadyIn) {
    btnHtml = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn-primary" disabled style="background:#27ae60; cursor:default;">Ya estás participando ✓</button>
        <button class="btn-secondary" id="detail-cancel" style="color:#c0392b; border-color:#c0392b; padding:10px; border-radius:8px; font-weight:600; cursor:pointer;">Cancelar mi postulación</button>
      </div>`;
  } else if (isCancelado) {
    btnHtml = `<button class="btn-primary" disabled style="background:#94a3b8; cursor:not-allowed;" title="Esta postulación fue cancelada y no puede volver a abrirse">Postulación cancelada</button>`;
  } else if (isFinalizado) {
    btnHtml = `<button class="btn-primary" disabled style="background:#64748b; cursor:not-allowed;" title="Esta postulación ya se encuentra finalizada">Postulación finalizada</button>`;
  } else if (sinCupos) {
    btnHtml = `<button class="btn-primary" disabled>Sin cupos por ahora</button>`;
  } else {
    btnHtml = `<button class="btn-primary" id="detail-join">Quiero participar</button>`;
  }

  const web = safeLink(item.web);
  const mpLink = obtenerLinkMercadoPago(item.linkPago) || 'https://link.mercadopago.com.ar/voluntariapp';

  const donarBtnHtml = `
    <button type="button" class="btn-donar-ong" id="detail-donar-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
      <span>Donar a esta ONG</span>
    </button>`;

  const totalPlazas = Math.max(1, Number(item.cupos || 0) + Number(item.voluntarios || 0));
  const ocupacionReal = Math.round((Number(item.voluntarios || 0) / totalPlazas) * 100);
  const ocupacionVisual = Math.max(14, ocupacionReal);
  const actividadReal = Math.min(100, Math.round((Number(item.voluntarios || 0) * 9) + 18));
  const actividadVisual = Math.max(20, actividadReal);
  const links = [
    web ? `<a class="detail-link" href="${esc(web)}" target="_blank" rel="noopener">🌐 Visitar sitio de la ONG</a>` : '',
    item.contacto ? `<span class="detail-row">✉️ Contacto: <strong>${esc(item.contacto)}</strong></span>` : '',
  ].filter(Boolean).join('');

  detail.classList.remove("hidden");
  detail.innerHTML = `
    <div class="detail-top-nav">
      <button class="detail-back-map" id="detail-back" type="button" title="Volver al mapa">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>Volver al mapa</span>
      </button>
      <div class="detail-top-right">
        <button class="detail-to-list-btn" id="detail-to-list" type="button">Ver lista</button>
        <button class="detail-close-x" id="detail-close-x" type="button" aria-label="Cerrar y volver al mapa">✕</button>
      </div>
    </div>

    <div class="detail-content-scroll">
      <div class="detail-mini-banner">
        <div class="detail-mini-banner-text">
          <span class="detail-mini-kicker">Convocatoria activa</span>
          <strong>${item.emoji} ${esc(item.nombre)}</strong>
          <small>${esc(item.barrio)}</small>
        </div>
        <span class="detail-mini-pill">${esc(CATEGORIA_LABELS[item.categoria] || item.categoria)}</span>
      </div>

      <span class="detail-category">${esc(CATEGORIA_LABELS[item.categoria] || item.categoria)}</span>
      <h2>${item.emoji} ${esc(item.nombre)} ${reviewBadge(item)}</h2>
      <p class="detail-desc">${esc(item.descripcion)}</p>
      ${item.necesidades ? `<p class="detail-row">🙌 Buscan: <strong>${esc(item.necesidades)}</strong></p>` : ''}
      <p class="detail-row">📍 <strong>${esc(item.barrio)}</strong></p>
      <p class="detail-row">⭐ ${item.rating} &nbsp;·&nbsp; 👥 ${item.inscriptos != null ? item.inscriptos : item.voluntarios} inscriptos de ${item.totalCupos || totalPlazas} cupos &nbsp;·&nbsp; ➤ ${item.distancia.toFixed(1)} km</p>
      <p class="detail-row">🤝 <strong>${item.cupos} lugares libres</strong></p>
      <div class="detail-metrics">
        <div class="detail-metric">
          <div class="detail-metric-head">
            <span>Cupos ocupados</span>
            <strong>${ocupacionReal}%</strong>
          </div>
          <div class="detail-metric-bar" role="presentation"><span style="width:${ocupacionVisual}%"></span></div>
        </div>
        <div class="detail-metric">
          <div class="detail-metric-head">
            <span>Actividad reciente</span>
            <strong>${actividadReal}%</strong>
          </div>
          <div class="detail-metric-bar detail-metric-bar--soft" role="presentation"><span style="width:${actividadVisual}%"></span></div>
        </div>
      </div>
      ${links ? `<div class="detail-links">${links}</div>` : ''}
      <div class="detail-actions">
        ${btnHtml}
        ${donarBtnHtml}
        <button class="btn-secondary" id="detail-center">Ver en mapa</button>
      </div>
    </div>`;

  const returnToMap = () => {
    state.selectedId = null;
    sidebar?.classList.remove("detail-open");
    sidebar?.classList.remove("open");
    document.body.classList.remove("detail-open");
    refresh(false);
    setTimeout(() => map.invalidateSize(), 150);
  };

  document.getElementById("detail-back")?.addEventListener("click", returnToMap);
  document.getElementById("detail-close-x")?.addEventListener("click", returnToMap);

  document.getElementById("detail-to-list")?.addEventListener("click", () => {
    state.selectedId = null;
    sidebar?.classList.remove("detail-open");
    document.body.classList.remove("detail-open");
    sidebar?.classList.add("open");
    refresh(false);
  });

  document.getElementById("detail-center")?.addEventListener("click", () => {
    sidebar?.classList.remove("detail-open");
    sidebar?.classList.remove("open");
    document.body.classList.remove("detail-open");
    detail.classList.add("hidden");
    setTimeout(() => {
      map.invalidateSize();
      map.flyTo([item.lat, item.lng], 15, { duration: 0.8 });
      markersById[item.id]?.openPopup();
    }, 120);
  });

  document.getElementById("detail-join")?.addEventListener("click", () => joinConvocatoria(item));
  document.getElementById("detail-cancel")?.addEventListener("click", () => cancelConvocatoria(item));



  document.getElementById("detail-donar-btn")?.addEventListener("click", () => {
    if (window.DonarONG) {
      window.DonarONG.abrir({
        nombre: item.nombreOrganizacion || item.nombre,
        mpLink: mpLink,
      });
    }
  });
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
      const btn = document.getElementById('detail-join');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Procesando...';
      }
      const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl}/api/convocatorias/${encodeURIComponent(item.id)}/participar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        item.cupos = data.lugares_libres != null ? data.lugares_libres : Math.max(0, item.cupos - 1);
        item.inscriptos = data.inscriptos_actuales != null ? data.inscriptos_actuales : (item.inscriptos || 0) + 1;
        item.voluntarios = item.inscriptos;
        if (state.postulacionesMap) state.postulacionesMap[String(item.id)] = 'POSTULADO';
        guardarParticipacion(item);
        toast(data.message || '¡Listo! Ya estás participando en esta convocatoria.', 'success');
        refresh(false);
        return;
      }
      if (res.status === 400 || res.status === 409) {
        toast(data.message || 'No se pudo registrar tu participación.', 'error');
        if (data.message && data.message.includes('Ya estás postulado')) {
          guardarParticipacion(item);
          if (state.postulacionesMap) state.postulacionesMap[String(item.id)] = 'POSTULADO';
          refresh(false);
        } else if (data.message && data.message.includes('cancelada')) {
          if (state.postulacionesMap) state.postulacionesMap[String(item.id)] = 'CANCELADO';
          refresh(false);
        }
        return;
      }
      throw new Error(data.message || 'Error del servidor');
    } catch (err) {
      toast(err.message || 'No pudimos conectar con el servidor.', 'error');
      refresh(false);
      return;
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
  item.inscriptos = (item.inscriptos || 0) + 1;
  item.voluntarios = item.inscriptos;
  toast('¡Listo! Ya estás participando en esta convocatoria.', 'success');
  refresh(false);
}

function confirmarCancelacionModal(titulo, onConfirm) {
  document.getElementById('modal-cancelar-postulacion')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'modal-cancelar-postulacion';
  backdrop.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #ffffff; max-width: 440px; width: 100%;
    border-radius: 16px; padding: 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
    font-family: inherit; color: #1e293b;
  `;

  const safeTitulo = String(titulo || 'esta convocatoria').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  modal.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
      <div style="width:40px; height:40px; border-radius:50%; background:#fee2e2; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
        ⚠️
      </div>
      <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:#0f172a;">¿Cancelar postulación?</h3>
    </div>
    <p style="margin:0 0 20px 0; font-size:0.95rem; line-height:1.5; color:#475569;">
      ¿Estás seguro de que querés cancelar tu postulación a <strong>"${safeTitulo}"</strong>? Tu lugar quedará disponible para otro voluntario y no podrás volver a postularte a esta convocatoria.
    </p>
    <div style="display:flex; justify-content:flex-end; gap:10px;">
      <button id="modal-cancel-cerrar" type="button" style="padding:10px 16px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; font-weight:600; cursor:pointer;">
        No, mantener
      </button>
      <button id="modal-cancel-confirmar" type="button" style="padding:10px 16px; border-radius:8px; border:none; background:#dc2626; color:#ffffff; font-weight:600; cursor:pointer;">
        Sí, cancelar postulación
      </button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  modal.querySelector('#modal-cancel-cerrar').addEventListener('click', close);
  modal.querySelector('#modal-cancel-confirmar').addEventListener('click', async () => {
    const btn = modal.querySelector('#modal-cancel-confirmar');
    btn.disabled = true;
    btn.textContent = 'Cancelando...';
    try {
      await onConfirm();
      close();
    } catch {
      btn.disabled = false;
      btn.textContent = 'Sí, cancelar postulación';
    }
  });
}

function cancelConvocatoria(item) {
  confirmarCancelacionModal(item.nombre || item.titulo, async () => {
    const token = sessionStorage.getItem('va_token');
    const btn = document.getElementById('detail-cancel');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Cancelando...';
    }
    if (token) {
      try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
        const res = await fetch(`${baseUrl}/api/convocatorias/${encodeURIComponent(item.id)}/participar`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          item.cupos = data.lugares_libres != null ? data.lugares_libres : (item.cupos || 0) + 1;
          item.inscriptos = data.inscriptos_actuales != null ? data.inscriptos_actuales : Math.max(0, (item.inscriptos || 1) - 1);
          item.voluntarios = item.inscriptos;
          if (state.postulacionesMap) state.postulacionesMap[String(item.id)] = 'CANCELADO';
          const rest = getMyParticipations().filter((p) => parteId(p) !== String(item.id));
          localStorage.setItem('va_parts_demo', JSON.stringify(rest));
          toast(data.message || 'Participación cancelada.', 'info');
          refresh(false);
          return;
        }
        throw new Error(data.message || 'No se pudo cancelar la participación.');
      } catch (err) {
        toast(err.message || 'Error al conectar con el servidor.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Cancelar mi postulación';
        }
        throw err;
      }
    }

    const rest = getMyParticipations().filter((p) => parteId(p) !== String(item.id));
    localStorage.setItem('va_parts_demo', JSON.stringify(rest));
    item.cupos = (item.cupos || 0) + 1;
    item.inscriptos = Math.max(0, (item.inscriptos || 1) - 1);
    item.voluntarios = item.inscriptos;
    toast('Participación cancelada.', 'info');
    refresh(false);
  });
}

function selectItem(id, openPopup) {
  state.selectedId = id;
  const item = state.items.find((o) => String(o.id) === String(id));
  if (item && window.innerWidth <= 900) {
    sidebar?.classList.add("open");
    sidebar?.classList.add("detail-open");
    document.body.classList.add("detail-open");
  }
  refresh(false);
  if (item) {
    map.flyTo([item.lat, item.lng], 14, { duration: 0.8 });
    if (openPopup !== false && window.innerWidth > 900) markersById[id]?.openPopup();
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
document.getElementById("search-input")?.addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  refresh(false);
});

// ---- Dropdowns personalizados de filtros (Categoría y Distancia) ----
const catWrapper = document.getElementById("dropdown-category-wrapper");
const catBtn = document.getElementById("filter-category-btn");
const catMenu = document.getElementById("category-dropdown-menu");
const catLabel = document.getElementById("filter-category-label");

const distWrapper = document.getElementById("dropdown-distance-wrapper");
const distBtn = document.getElementById("distance-btn");
const distMenu = document.getElementById("distance-dropdown-menu");
const distLabel = document.getElementById("distance-label");

function closeFilterDropdowns() {
  catMenu?.classList.add("hidden");
  catWrapper?.classList.remove("open");
  catBtn?.setAttribute("aria-expanded", "false");

  distMenu?.classList.add("hidden");
  distWrapper?.classList.remove("open");
  distBtn?.setAttribute("aria-expanded", "false");
}

catBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = !catMenu?.classList.contains("hidden");
  closeFilterDropdowns();
  if (!isOpen && catMenu) {
    catMenu.classList.remove("hidden");
    catWrapper?.classList.add("open");
    catBtn.setAttribute("aria-expanded", "true");
  }
});

distBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = !distMenu?.classList.contains("hidden");
  closeFilterDropdowns();
  if (!isOpen && distMenu) {
    distMenu.classList.remove("hidden");
    distWrapper?.classList.add("open");
    distBtn.setAttribute("aria-expanded", "true");
  }
});

// Selección de categoría en menú personalizado
catMenu?.querySelectorAll(".dropdown-item").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const val = btn.dataset.value;
    state.categoria = val;
    catMenu.querySelectorAll(".dropdown-item").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");

    const text = val === "todas" ? "Todas" : (CATEGORIA_LABELS[val] || val);
    if (catLabel) catLabel.textContent = text;
    closeFilterDropdowns();
    refresh(true);
  });
});

// Selección de distancia en menú personalizado
distMenu?.querySelectorAll(".dropdown-item").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const km = Number(btn.dataset.value);
    state.maxDistancia = km;
    distMenu.querySelectorAll(".dropdown-item").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");

    const text = km === 0 ? "Distancia" : `Hasta ${km} km`;
    if (distLabel) distLabel.textContent = text;
    closeFilterDropdowns();
    refresh(true);
  });
});

// Cerrar dropdowns al hacer clic fuera o presionar Escape
document.addEventListener("click", (e) => {
  if (!catWrapper?.contains(e.target) && !distWrapper?.contains(e.target)) {
    closeFilterDropdowns();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeFilterDropdowns();
});

document.getElementById("locate-btn")?.addEventListener("click", () => {
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
document.getElementById("sidebar-close")?.addEventListener("click", () => {
  sidebar?.classList.remove("open");
  sidebar?.classList.remove("detail-open");
  document.body.classList.remove("detail-open");
  state.selectedId = null;
  refresh(false);
  setTimeout(() => map.invalidateSize(), 200);
});
document.getElementById("fab-list")?.addEventListener("click", () => {
  sidebar?.classList.toggle("open");
  setTimeout(() => map.invalidateSize(), 200);
});
if (window.innerWidth > 900) sidebar?.classList.add("open");

// Leaflet map resizing listener for mobile and orientation changes
window.addEventListener("resize", () => {
  map.invalidateSize();
  if (window.innerWidth > 900) {
    sidebar?.classList.add("open");
  }
});
window.addEventListener("orientationchange", () => {
  setTimeout(() => map.invalidateSize(), 250);
});

// Inicio: header + datos reales (API) + retorno ?conv=
(async function init() {
  renderHeader();
  refresh(false); // Muestra estado de carga de inmediato
  await loadItems();
  refresh(false);
  setTimeout(() => map.invalidateSize(), 250);
  const convId = new URLSearchParams(window.location.search).get('conv');
  if (convId && state.items.some((o) => String(o.id) === String(convId))) {
    selectItem(convId, true);
    if (window.innerWidth <= 900) {
      sidebar?.classList.add("open");
      sidebar?.classList.add("detail-open");
    }
  } else {
    // Si la ONG demo tiene una ubicación modificada o sesión de ONG activa, centrar en ella
    const session = getSession();
    const override = JSON.parse(localStorage.getItem('va_demo_ong_override') || 'null');
    if (override || (session && session.rol === 'ong')) {
      const demoItem = state.items.find(i => i.esDemoModificado || (i.nombreOrganizacion && i.nombreOrganizacion.toLowerCase().includes('cruz roja')));
      if (demoItem) {
        setTimeout(() => {
          map.flyTo([demoItem.lat, demoItem.lng], 14, { duration: 0.8 });
          markersById[demoItem.id]?.openPopup();
        }, 350);
      }
    }
  }
})();
