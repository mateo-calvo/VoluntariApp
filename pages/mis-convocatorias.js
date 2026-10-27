// mis-convocatorias.js - Gestión de convocatorias de la ONG
const API_URL = (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:8000' : 'https://voluntariapp-1.onrender.com');

let convocatoriasCache = [];
let causasCache = [];
let provinciasCache = [];
let filtroEstadoActual = 'TODAS';
let filtroNombre = '';
let filtroFecha = '';
let filtroCausaActual = '';
let ordenCronologico = 'fecha-asc';
let postulantesModalCache = [];
let convocatoriaActivaModal = null;
let subfiltroPostulanteActual = 'TODOS';

document.addEventListener('DOMContentLoaded', async () => {
  const session = leerSesion();
  if (!session || session.rol !== 'ong') {
    window.location.href = 'login.html?next=mis-convocatorias.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
  activarFiltrosEstado();
  activarFiltrosBusqueda();
  activarEventosModalPostulantes();
  activarAutocompletadoModal();
  activarEventosModal();

  await cargarCausas();
  await cargarProvincias();
  await cargarConvocatorias(session);
});

function leerSesion() {
  try {
    return JSON.parse(sessionStorage.getItem('va_session') || 'null');
  } catch {
    return null;
  }
}

function leerToken() {
  return sessionStorage.getItem('va_token') || '';
}

function manejarSesionExpirada() {
  sessionStorage.removeItem('va_token');
  sessionStorage.removeItem('va_session');
  window.location.href = 'login.html?expired=1&next=mis-convocatorias.html';
}

function formatearFechaHora(fecha, hora) {
  if (!fecha) return 'A coordinar';
  let strFecha = fecha;
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    const [y, m, d] = fecha.slice(0, 10).split('-');
    strFecha = `${d}/${m}/${y}`;
  }
  let strHora = '';
  if (hora) {
    strHora = ` · ${String(hora).slice(0, 5)} hs`;
  }
  return `${strFecha}${strHora}`;
}

function pintarUsuario(session) {
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = session.nombre || session.email;
  if (avatarEl) avatarEl.textContent = ((session.nombre || session.email || 'O')[0] || 'O').toUpperCase();
}

function activarSalir() {
  document.getElementById('logout-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem('va_token');
    sessionStorage.removeItem('va_session');
    window.location.href = '../index.html';
  });
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showError(msg) {
  const box = document.getElementById('panel-error');
  const ok = document.getElementById('panel-ok');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  ok?.classList.add('hidden');
}

function showOk(msg) {
  const box = document.getElementById('panel-ok');
  const err = document.getElementById('panel-error');
  if (!box) return;
  box.innerHTML = msg;
  box.classList.remove('hidden');
  err?.classList.add('hidden');
}

function showModalError(msg) {
  const box = document.getElementById('modal-error');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
}

function hideModalError() {
  const box = document.getElementById('modal-error');
  if (box) box.classList.add('hidden');
}

async function cargarCausas() {
  const selectCausa = document.getElementById('c-causa');
  const token = leerToken();

  const cachedCausas = sessionStorage.getItem('va_cat_causas');
  if (cachedCausas) {
    try { causasCache = JSON.parse(cachedCausas); } catch (_) {}
  }
  if (!causasCache || causasCache.length === 0) {
    try {
      const res = await fetch(`${API_URL}/api/causas/`);
      if (res.ok) {
        causasCache = await res.json();
        try { sessionStorage.setItem('va_cat_causas', JSON.stringify(causasCache)); } catch (_) {}
      }
    } catch (err) {
      console.warn('No se pudieron cargar causas desde API, usando respaldo:', err);
    }
  }

  if (!causasCache || causasCache.length === 0) {
    causasCache = [
      { id: 1, nombre: 'Desarrollo social' },
      { id: 2, nombre: 'Salud' },
      { id: 3, nombre: 'Educación' },
      { id: 4, nombre: 'Medioambiente' },
      { id: 5, nombre: 'Infancias y juventudes' },
      { id: 6, nombre: 'Derechos humanos' },
    ];
  }

  if (selectCausa) {
    selectCausa.innerHTML = '<option value="">Seleccioná una causa...</option>' +
      causasCache.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }

  const filtroCausa = document.getElementById('filtro-causa');
  if (filtroCausa) {
    filtroCausa.innerHTML = '<option value="">Todas las causas</option>' +
      causasCache.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }
}

async function cargarProvincias() {
  const selectProv = document.getElementById('c-provincia');
  if (!selectProv) return;

  const cachedProv = sessionStorage.getItem('va_cat_provincias');
  if (cachedProv) {
    try { provinciasCache = JSON.parse(cachedProv); } catch (_) {}
  }

  if (!provinciasCache || provinciasCache.length === 0) {
    try {
      const res = await fetch(`${API_URL}/api/provincias/`);
      if (res.ok) {
        provinciasCache = await res.json();
        try { sessionStorage.setItem('va_cat_provincias', JSON.stringify(provinciasCache)); } catch (_) {}
      }
    } catch (err) {
      console.warn('Error cargando provincias:', err);
    }
  }

  if (provinciasCache && provinciasCache.length > 0) {
    selectProv.innerHTML = '<option value="" disabled selected>Selecciona una provincia</option>' +
      provinciasCache.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
  }

  selectProv.addEventListener('change', async () => {
    const provId = selectProv.value;
    await actualizarLocalidadesPorProvincia(provId);
  });
}

async function actualizarLocalidadesPorProvincia(provId, selectedLocId = null) {
  const selectLoc = document.getElementById('c-localidad');
  if (!selectLoc) return;

  selectLoc.disabled = true;
  selectLoc.innerHTML = '<option value="" disabled selected>Cargando localidades...</option>';

  if (!provId) return;

  try {
    let data = null;
    const cacheKey = `va_cat_loc_${provId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try { data = JSON.parse(cached); } catch (_) {}
    }
    if (!data) {
      const res = await fetch(`${API_URL}/api/localidades/?provincia_id=${encodeURIComponent(provId)}`);
      if (res.ok) {
        data = await res.json();
        try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
      }
    }

    if (data && Array.isArray(data)) {
      selectLoc.innerHTML = '<option value="" disabled selected>Selecciona una localidad</option>' +
        data.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('');
      selectLoc.disabled = false;
      if (selectedLocId) {
        selectLoc.value = String(selectedLocId);
      }
    }
  } catch (err) {
    console.warn('Error cargando localidades:', err);
    selectLoc.innerHTML = '<option value="" disabled selected>Error al cargar localidades</option>';
  }
}

async function cargarConvocatorias(session) {
  const contenedor = document.getElementById('convocatorias-lista');
  const token = leerToken();

  if (token) {
    try {
      const res = await fetch(`${API_URL}/api/ong/mis-convocatorias`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        manejarSesionExpirada();
        return;
      }
      if (res.ok) {
        convocatoriasCache = await res.json();
        renderizarConvocatorias(convocatoriasCache);
        return;
      }
    } catch (err) {
      console.warn('Error cargando convocatorias desde API, usando fallback:', err);
    }
  }

  // Fallback demo local
  try {
    const local = JSON.parse(localStorage.getItem('va_convocatorias_demo') || 'null');
    if (local && Array.isArray(local)) {
      convocatoriasCache = local;
    } else {
      convocatoriasCache = [
        {
          id: 'demo-1',
          titulo: 'Puesto de Primeros Auxilios y Prevención',
          causa_id: 2,
          causa_nombre: 'Salud',
          fecha: '2026-11-15',
          hora: '09:00',
          lugar: 'Parque Centenario, Caballito',
          direccion: 'Av. Díaz Vélez 4800, CABA',
          cupos_totales: 15,
          horas_estimadas: 4,
          descripcion: 'Capacitación y atención a vecinos en controles básicos de salud y maniobras RCP.',
          estado: 'abierta'
        }
      ];
      localStorage.setItem('va_convocatorias_demo', JSON.stringify(convocatoriasCache));
    }
  } catch {
    convocatoriasCache = [];
  }

  renderizarConvocatorias(convocatoriasCache);
}

function renderizarConvocatorias(lista) {
  const contenedor = document.getElementById('convocatorias-lista');
  if (!contenedor) return;

  const fuente = lista || convocatoriasCache || [];
  actualizarStats(convocatoriasCache);

  // 1. Filtrar según filtroEstadoActual
  let filtradas = filtroEstadoActual === 'TODAS'
    ? fuente
    : fuente.filter(c => (c.estado || 'ABIERTA').toUpperCase() === filtroEstadoActual);

  // 2. Filtrar por nombre (título o descripción)
  if (filtroNombre && filtroNombre.trim() !== '') {
    const term = filtroNombre.trim().toLowerCase();
    filtradas = filtradas.filter(c => {
      const tit = (c.titulo || '').toLowerCase();
      const desc = (c.descripcion || '').toLowerCase();
      const causa = (c.causa_nombre || '').toLowerCase();
      return tit.includes(term) || desc.includes(term) || causa.includes(term);
    });
  }

  // 3. Filtrar por fecha exacta del voluntariado
  if (filtroFecha && filtroFecha.trim() !== '') {
    filtradas = filtradas.filter(c => {
      if (!c.fecha) return false;
      return String(c.fecha).startsWith(filtroFecha);
    });
  }

  // 4. Filtrar por causa
  if (filtroCausaActual) {
    filtradas = filtradas.filter(c => String(c.causa_id) === String(filtroCausaActual));
  }

  // 4. Ordenar cronológicamente o alfabéticamente
  filtradas.sort((a, b) => {
    if (ordenCronologico === 'alfabetico') {
      return (a.titulo || '').localeCompare(b.titulo || '');
    }

    const fechaA = a.fecha || (ordenCronologico === 'fecha-asc' ? '9999-12-31' : '0000-00-00');
    const horaA = a.hora || '00:00';
    const fechaB = b.fecha || (ordenCronologico === 'fecha-asc' ? '9999-12-31' : '0000-00-00');
    const horaB = b.hora || '00:00';

    const dtA = `${fechaA}T${horaA}`;
    const dtB = `${fechaB}T${horaB}`;

    if (ordenCronologico === 'fecha-desc') {
      return dtB.localeCompare(dtA);
    }
    // Por defecto 'fecha-asc' (más próximas primero)
    return dtA.localeCompare(dtB);
  });

  if (!filtradas || filtradas.length === 0) {
    if (convocatoriasCache.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <h3>Aún no tenés convocatorias publicadas</h3>
          <p>Hacé clic en el botón superior para crear tu primera oportunidad de voluntariado.</p>
        </div>
      `;
    } else if (filtroNombre || filtroFecha || filtroCausaActual) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <h3>No se encontraron convocatorias</h3>
          <p>Ninguna convocatoria coincide con los filtros aplicados.</p>
        </div>
      `;
    } else {
      const NOMBRES = { ABIERTA: 'abiertas', COMPLETA: 'cerradas', FINALIZADA: 'finalizadas', CANCELADA: 'canceladas' };
      const txt = NOMBRES[filtroEstadoActual] || filtroEstadoActual.toLowerCase();
      contenedor.innerHTML = `
        <div class="empty-state">
          <h3>No hay convocatorias ${txt}</h3>
          <p>Podés seleccionar otro filtro para ver el resto de tus convocatorias.</p>
        </div>
      `;
    }
    return;
  }

  contenedor.innerHTML = filtradas.map((c) => {
    const rawEstado = (c.estado || 'ABIERTA').toUpperCase();
    let estadoLabel = 'Abierta';
    let badgeClass = '';
    if (rawEstado === 'COMPLETA') {
      estadoLabel = 'Cerrada';
      badgeClass = 'warn';
    } else if (rawEstado === 'FINALIZADA') {
      estadoLabel = 'Finalizada';
      badgeClass = 'muted';
    } else if (rawEstado === 'CANCELADA') {
      estadoLabel = 'Cancelada';
      badgeClass = 'warn';
    }

    const causaTxt = c.causa_nombre || (causasCache.find(x => x.id === c.causa_id)?.nombre) || 'General';
    const esTerminal = ['CANCELADA', 'FINALIZADA'].includes(rawEstado);

    return `
      <article class="convocatoria-card ${esTerminal ? 'convocatoria-cerrada' : ''}" data-id="${esc(c.id)}">
        <div class="convocatoria-top">
          <div>
            <h3 class="convocatoria-title">${esc(c.titulo)}</h3>
            <div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span class="badge ${badgeClass}">${estadoLabel}</span>
              <span class="badge muted">${esc(causaTxt)}</span>
              ${c.requiere_aprobacion
                ? `<span class="badge" style="background:#fef3c7;color:#92400e;font-size:11px;">Requiere aprobación</span>`
                : `<span class="badge" style="background:#f0fdf4;color:#166534;font-size:11px;">Inscripción directa</span>`
              }
            </div>
          </div>
        </div>

        <div class="convocatoria-meta">
          <span>📅 ${esc(formatearFechaHora(c.fecha, c.hora))}</span>
          ${c.lugar || c.direccion ? `<span>📍 ${esc(c.lugar || c.direccion)}${c.localidad_nombre ? ' (' + esc(c.localidad_nombre) + ')' : ''}</span>` : ''}
          <span>👥 ${esc(c.cupos_totales ?? 10)} cupos</span>
          ${c.horas_estimadas ? `<span>⏱️ ${esc(c.horas_estimadas)} hs</span>` : ''}
        </div>

        ${c.descripcion ? `<p class="convocatoria-desc">${esc(c.descripcion)}</p>` : ''}

        <div class="convocatoria-actions" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm btn-postulantes" data-id="${esc(c.id)}" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;">
            👥 Postulantes <span class="count-badge" style="background:#e2e8f0;color:#0f172a;padding:1px 6px;border-radius:999px;font-size:11px;">${c.postulantes_count ?? 0}</span>
          </button>

          ${esTerminal
            ? `<button type="button" class="btn btn-secondary btn-sm" disabled style="opacity:0.55; cursor:not-allowed;" title="Esta convocatoria está ${rawEstado === 'CANCELADA' ? 'cancelada' : 'finalizada'} y no se puede editar">✏️ Editar</button>`
            : `<button type="button" class="btn btn-secondary btn-sm btn-editar" data-id="${esc(c.id)}">✏️ Editar</button>`
          }

          <label style="font-size:13px;font-weight:700;color:var(--color-muted);margin-left:auto;display:flex;align-items:center;gap:6px;">
            Estado:
            ${esTerminal
              ? `<select class="select-estado-rapido" disabled style="padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;font-family:inherit;font-size:13px;font-weight:600;background:#f1f5f9;color:#64748b;cursor:not-allowed;" title="Una convocatoria cancelada o finalizada no puede volver a cambiar de estado">
                  <option value="${rawEstado}" selected>${rawEstado === 'CANCELADA' ? 'Cancelada' : 'Finalizada'}</option>
                </select>`
              : `<select class="select-estado-rapido" data-id="${esc(c.id)}" style="padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;font-family:inherit;font-size:13px;font-weight:600;background:#fff;cursor:pointer;">
                  <option value="ABIERTA" ${rawEstado === 'ABIERTA' ? 'selected' : ''}>Abierta</option>
                  <option value="COMPLETA" ${rawEstado === 'COMPLETA' ? 'selected' : ''}>Cerrada</option>
                  <option value="FINALIZADA" ${rawEstado === 'FINALIZADA' ? 'selected' : ''}>Finalizada</option>
                  <option value="CANCELADA" ${rawEstado === 'CANCELADA' ? 'selected' : ''}>Cancelada</option>
                </select>`
            }
          </label>
        </div>
      </article>
    `;
  }).join('');

  // Eventos de botones en tarjetas
  contenedor.querySelectorAll('.btn-postulantes').forEach(btn => {
    btn.addEventListener('click', () => abrirModalPostulantes(btn.dataset.id));
  });

  contenedor.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditar(btn.dataset.id));
  });

  contenedor.querySelectorAll('.select-estado-rapido').forEach(sel => {
    if (sel.disabled) return;
    sel.dataset.prev = sel.value;
    sel.addEventListener('focus', () => {
      sel.dataset.prev = sel.value;
    });
    sel.addEventListener('change', async () => {
      const nuevoEstado = sel.value;
      const prevEstado = sel.dataset.prev || 'ABIERTA';
      const NOMBRES_ESTADO = { ABIERTA: 'Abierta', COMPLETA: 'Cerrada', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
      const nombreVisible = NOMBRES_ESTADO[nuevoEstado.toUpperCase()] || nuevoEstado;

      const advertencia = ['CANCELADA', 'FINALIZADA'].includes(nuevoEstado.toUpperCase())
        ? ' Atención: una vez cancelada o finalizada, la convocatoria no podrá volver a cambiar de estado.'
        : '';
      const confirmar = await solicitarConfirmacion(`¿Estás seguro de que deseas cambiar el estado de esta convocatoria a "${nombreVisible}"?${advertencia}`);
      if (!confirmar) {
        sel.value = prevEstado;
        return;
      }

      sel.dataset.prev = nuevoEstado;
      toggleEstadoConvocatoria(sel.dataset.id, nuevoEstado);
    });
  });
}

function solicitarConfirmacion(mensaje) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirmacion');
    const msgEl = document.getElementById('confirmacion-mensaje');
    const btnAceptar = document.getElementById('btn-confirmar-aceptar');
    const btnCancelar = document.getElementById('btn-confirmar-cancelar');

    if (msgEl) msgEl.textContent = mensaje;
    modal?.classList.remove('hidden');

    const limpiar = () => {
      modal?.classList.add('hidden');
      btnAceptar?.removeEventListener('click', onAceptar);
      btnCancelar?.removeEventListener('click', onCancelar);
      modal?.removeEventListener('click', onOverlay);
    };

    const onAceptar = () => {
      limpiar();
      resolve(true);
    };

    const onCancelar = () => {
      limpiar();
      resolve(false);
    };

    const onOverlay = (e) => {
      if (e.target === modal) {
        limpiar();
        resolve(false);
      }
    };

    btnAceptar?.addEventListener('click', onAceptar);
    btnCancelar?.addEventListener('click', onCancelar);
    modal?.addEventListener('click', onOverlay);
  });
}

function actualizarStats(lista) {
  const arr = lista || [];
  const abiertas = arr.filter(c => (c.estado || 'ABIERTA').toUpperCase() === 'ABIERTA').length;
  const completas = arr.filter(c => (c.estado || 'ABIERTA').toUpperCase() === 'COMPLETA').length;
  const finalizadas = arr.filter(c => (c.estado || 'ABIERTA').toUpperCase() === 'FINALIZADA').length;
  const canceladas = arr.filter(c => (c.estado || 'ABIERTA').toUpperCase() === 'CANCELADA').length;
  const total = arr.length;
  const asistencias = arr.reduce((acc, c) => acc + (Number(c.asistencias_pendientes ?? c.postulantes_count) || 0), 0);

  const elActivas = document.getElementById('stat-activas');
  const elTotal = document.getElementById('stat-total');
  const elAsistencias = document.getElementById('stat-asistencias');

  if (elActivas) elActivas.textContent = abiertas;
  if (elTotal) elTotal.textContent = total;
  if (elAsistencias) elAsistencias.textContent = asistencias;

  // Actualizar badges numéricos de filtros
  const cTodas = document.getElementById('count-todas');
  const cAbiertas = document.getElementById('count-abierta');
  const cCompletas = document.getElementById('count-completa');
  const cFinalizadas = document.getElementById('count-finalizada');
  const cCanceladas = document.getElementById('count-cancelada');

  if (cTodas) cTodas.textContent = total;
  if (cAbiertas) cAbiertas.textContent = abiertas;
  if (cCompletas) cCompletas.textContent = completas;
  if (cFinalizadas) cFinalizadas.textContent = finalizadas;
  if (cCanceladas) cCanceladas.textContent = canceladas;
}

function aplicarFiltroEstado(nuevoFiltro) {
  filtroEstadoActual = nuevoFiltro;

  const contenedorFiltros = document.getElementById('filtros-estado');
  if (contenedorFiltros) {
    contenedorFiltros.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filtro === nuevoFiltro);
    });
  }

  document.querySelectorAll('.stat-card[data-filtro]').forEach(card => {
    card.classList.toggle('active-filter', card.dataset.filtro === nuevoFiltro);
  });

  renderizarConvocatorias(convocatoriasCache);
}

function activarFiltrosEstado() {
  const contenedorFiltros = document.getElementById('filtros-estado');
  if (contenedorFiltros) {
    contenedorFiltros.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        aplicarFiltroEstado(btn.dataset.filtro);
      });
    });
  }

  document.querySelectorAll('.stat-card[data-filtro]').forEach(card => {
    const disparar = () => {
      aplicarFiltroEstado(card.dataset.filtro);
    };
    card.addEventListener('click', disparar);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        disparar();
      }
    });
  });
}

function activarFiltrosBusqueda() {
  const inputNombre = document.getElementById('filtro-nombre');
  const inputFecha = document.getElementById('filtro-fecha');
  const btnLimpiarFecha = document.getElementById('btn-limpiar-fecha');
  const selectOrden = document.getElementById('filtro-orden');

  inputNombre?.addEventListener('input', (e) => {
    filtroNombre = e.target.value;
    renderizarConvocatorias(convocatoriasCache);
  });

  inputFecha?.addEventListener('change', (e) => {
    filtroFecha = e.target.value;
    if (filtroFecha) {
      btnLimpiarFecha?.classList.remove('hidden');
    } else {
      btnLimpiarFecha?.classList.add('hidden');
    }
    renderizarConvocatorias(convocatoriasCache);
  });

  btnLimpiarFecha?.addEventListener('click', () => {
    if (inputFecha) inputFecha.value = '';
    filtroFecha = '';
    btnLimpiarFecha.classList.add('hidden');
    renderizarConvocatorias(convocatoriasCache);
  });

  const selectCausa = document.getElementById('filtro-causa');
  selectCausa?.addEventListener('change', (e) => {
    filtroCausaActual = e.target.value;
    renderizarConvocatorias(convocatoriasCache);
  });

  selectOrden?.addEventListener('change', (e) => {
    ordenCronologico = e.target.value;
    renderizarConvocatorias(convocatoriasCache);
  });
}

function activarEventosModal() {
  const modal = document.getElementById('modal-convocatoria');
  const btnNuevo = document.getElementById('btn-nueva-convocatoria');
  const btnCerrar = document.getElementById('btn-cerrar-modal');
  const btnCancelar = document.getElementById('btn-cancelar-modal');
  const form = document.getElementById('convocatoria-form');

  btnNuevo?.addEventListener('click', () => abrirModalNuevo());
  btnCerrar?.addEventListener('click', () => cerrarModal());
  btnCancelar?.addEventListener('click', () => cerrarModal());

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
  });

  form?.addEventListener('submit', guardarConvocatoria);
}

function abrirModalNuevo() {
  hideModalError();
  document.getElementById('modal-titulo').textContent = 'Nueva convocatoria';
  document.getElementById('convocatoria-form').reset();
  document.getElementById('c-id').value = '';
  document.getElementById('c-estado').value = 'ABIERTA';
  document.getElementById('grupo-c-estado')?.classList.add('hidden');
  const reqApr = document.getElementById('c-requiere-aprobacion');
  if (reqApr) reqApr.checked = false;

  const selectLoc = document.getElementById('c-localidad');
  if (selectLoc) {
    selectLoc.innerHTML = '<option value="" disabled selected>Primero elegí una provincia</option>';
    selectLoc.disabled = true;
  }

  document.getElementById('modal-convocatoria')?.classList.remove('hidden');
  document.getElementById('c-titulo')?.focus();
}

async function abrirModalEditar(id) {
  hideModalError();
  const c = convocatoriasCache.find(x => String(x.id) === String(id));
  if (!c) return;

  const rawEstado = (c.estado || 'ABIERTA').toUpperCase();
  if (['CANCELADA', 'FINALIZADA'].includes(rawEstado)) {
    showError(`Esta convocatoria está ${rawEstado === 'CANCELADA' ? 'cancelada' : 'finalizada'} y no se puede editar.`);
    return;
  }

  document.getElementById('modal-titulo').textContent = 'Editar convocatoria';
  document.getElementById('c-id').value = c.id;
  document.getElementById('c-titulo').value = c.titulo || '';
  document.getElementById('c-causa').value = c.causa_id || '';
  document.getElementById('c-cupos').value = c.cupos_totales ?? 10;
  document.getElementById('c-fecha').value = c.fecha || '';
  document.getElementById('c-hora').value = c.hora ? String(c.hora).slice(0,5) : '09:00';

  const selectProv = document.getElementById('c-provincia');
  if (selectProv) {
    selectProv.value = c.provincia_id || '';
  }
  if (c.provincia_id) {
    await actualizarLocalidadesPorProvincia(c.provincia_id, c.localidad_id);
  } else {
    const selectLoc = document.getElementById('c-localidad');
    if (selectLoc) {
      selectLoc.innerHTML = '<option value="" disabled selected>Primero elegí una provincia</option>';
      selectLoc.disabled = true;
    }
  }

  document.getElementById('c-direccion').value = c.lugar || c.direccion || '';
  document.getElementById('c-lat').value = c.latitud || '';
  document.getElementById('c-lng').value = c.longitud || '';
  document.getElementById('c-descripcion').value = c.descripcion || '';
  document.getElementById('c-horas').value = c.horas_estimadas ?? 4;
  document.getElementById('c-estado').value = (c.estado || 'ABIERTA').toUpperCase();
  document.getElementById('grupo-c-estado')?.classList.remove('hidden');
  const reqApr = document.getElementById('c-requiere-aprobacion');
  if (reqApr) reqApr.checked = Boolean(c.requiere_aprobacion);

  document.getElementById('modal-convocatoria')?.classList.remove('hidden');
  document.getElementById('c-titulo')?.focus();
}

function cerrarModal() {
  document.getElementById('modal-convocatoria')?.classList.add('hidden');
  hideModalError();
}

function activarAutocompletadoModal() {
  const inputDir = document.getElementById('c-direccion');
  const inputLat = document.getElementById('c-lat');
  const inputLng = document.getElementById('c-lng');

  if (window.conectarAutocompletadoUbicacion && inputDir) {
    window.conectarAutocompletadoUbicacion(inputDir, {
      lista: '#c-dir-sugerencias',
      onSelect: (item, info) => {
        if (inputLat) inputLat.value = parseFloat(info.lat).toFixed(6);
        if (inputLng) inputLng.value = parseFloat(info.lon).toFixed(6);
      },
      onInput: () => {
        if (inputLat) inputLat.value = '';
        if (inputLng) inputLng.value = '';
      }
    });
  }
}

async function guardarConvocatoria(e) {
  e.preventDefault();
  hideModalError();

  const id = document.getElementById('c-id').value;
  const titulo = document.getElementById('c-titulo').value.trim();
  const causaId = parseInt(document.getElementById('c-causa').value, 10);
  const provinciaId = parseInt(document.getElementById('c-provincia').value, 10);
  const localidadId = parseInt(document.getElementById('c-localidad').value, 10);
  const cupos = parseInt(document.getElementById('c-cupos').value, 10) || 10;
  const fecha = document.getElementById('c-fecha').value;
  const hora = document.getElementById('c-hora').value || null;
  const direccion = document.getElementById('c-direccion').value.trim();
  let lat = parseFloat(document.getElementById('c-lat').value);
  let lng = parseFloat(document.getElementById('c-lng').value);
  const descripcion = document.getElementById('c-descripcion').value.trim();
  const horasEstimadas = parseInt(document.getElementById('c-horas').value, 10) || 4;
  const estado = (document.getElementById('c-estado').value || 'ABIERTA').toUpperCase();

  if (id) {
    const previa = convocatoriasCache.find(x => String(x.id) === String(id));
    const estadoPrevio = (previa?.estado || 'ABIERTA').toUpperCase();
    if (['CANCELADA', 'FINALIZADA'].includes(estadoPrevio)) {
      return showModalError(`Esta convocatoria ya se encuentra ${estadoPrevio.toLowerCase()} y no puede ser modificada.`);
    }
    if (estado !== estadoPrevio) {
      const NOMBRES_ESTADO = { ABIERTA: 'Abierta', COMPLETA: 'Cerrada', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
      const nombreVisible = NOMBRES_ESTADO[estado] || estado;
      const advertencia = ['CANCELADA', 'FINALIZADA'].includes(estado)
        ? ' Atención: una vez cancelada o finalizada, la convocatoria no podrá volver a cambiar de estado.'
        : '';
      const confirmar = await solicitarConfirmacion(`¿Estás seguro de que deseas cambiar el estado de esta convocatoria a "${nombreVisible}"?${advertencia}`);
      if (!confirmar) return;
    }
  }

  if (!titulo || titulo.length < 4) {
    return showModalError('El título debe tener al menos 4 caracteres.');
  }
  if (!causaId) {
    return showModalError('Por favor seleccioná una causa / categoría.');
  }
  if (!provinciaId) {
    return showModalError('Por favor seleccioná una provincia.');
  }
  if (!localidadId) {
    return showModalError('Por favor seleccioná una localidad / municipio.');
  }
  if (!fecha) {
    return showModalError('Indicá la fecha de la convocatoria.');
  }
  if (!direccion) {
    return showModalError('Ingresá el lugar o dirección del voluntariado.');
  }
  if (!descripcion || descripcion.length < 10) {
    return showModalError('La descripción debe detallar las tareas (mín. 10 caracteres).');
  }

  // Geocodificación fallback si no se seleccionó sugerencia
  if (isNaN(lat) || isNaN(lng)) {
    try {
      const q = encodeURIComponent(`${direccion}, Argentina`);
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
        headers: { 'Accept-Language': 'es' }
      });
      const geoData = await geoRes.json();
      if (Array.isArray(geoData) && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
      }
    } catch (err) {
      console.warn('Geocodificación fallback en convocatoria:', err);
    }
  }

  if (isNaN(lat)) lat = -34.6037;
  if (isNaN(lng)) lng = -58.3816;

  lat = parseFloat(Number(lat).toFixed(6));
  lng = parseFloat(Number(lng).toFixed(6));

  const requiereAprobacion = Boolean(document.getElementById('c-requiere-aprobacion')?.checked);

  const payload = {
    titulo,
    causa_id: causaId,
    provincia_id: provinciaId,
    localidad_id: localidadId,
    cupos_totales: cupos,
    fecha,
    hora,
    lugar: direccion,
    direccion,
    latitud: lat,
    longitud: lng,
    descripcion,
    horas_estimadas: horasEstimadas,
    estado,
    requiere_aprobacion: requiereAprobacion,
  };

  const btnSubmit = document.getElementById('btn-guardar-convocatoria');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
  }

  const token = leerToken();
  const isEditing = Boolean(id);

  if (token) {
    try {
      const url = isEditing
        ? `${API_URL}/api/ong/mis-convocatorias/${encodeURIComponent(id)}`
        : `${API_URL}/api/ong/mis-convocatorias`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        manejarSesionExpirada();
        return;
      }

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.message || 'Error al procesar la convocatoria en el servidor.');
      }

      cerrarModal();
      showOk(isEditing ? '¡Convocatoria actualizada con éxito!' : '¡Nueva convocatoria publicada con éxito!');
      await cargarConvocatorias(leerSesion());
      return;
    } catch (err) {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar convocatoria';
      }
      return showModalError(err.message || 'Error al conectar con el servidor.');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar convocatoria';
      }
    }
  }

  // Fallback offline / demo local
  if (isEditing) {
    const idx = convocatoriasCache.findIndex(x => String(x.id) === String(id));
    if (idx >= 0) {
      convocatoriasCache[idx] = { ...convocatoriasCache[idx], ...payload, id };
    }
  } else {
    const nueva = {
      ...payload,
      id: 'demo-' + Date.now(),
      created_at: new Date().toISOString()
    };
    convocatoriasCache.unshift(nueva);
  }

  localStorage.setItem('va_convocatorias_demo', JSON.stringify(convocatoriasCache));
  cerrarModal();
  showOk(isEditing ? '¡Convocatoria actualizada!' : '¡Nueva convocatoria publicada!');
  renderizarConvocatorias(convocatoriasCache);

  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Guardar convocatoria';
  }
}

async function toggleEstadoConvocatoria(id, nuevoEstado) {
  const previa = convocatoriasCache.find(x => String(x.id) === String(id));
  if (previa && ['CANCELADA', 'FINALIZADA'].includes((previa.estado || '').toUpperCase())) {
    return showError(`Esta convocatoria ya está ${previa.estado.toLowerCase()} y no puede volver a cambiar de estado.`);
  }

  const token = leerToken();

  if (token) {
    try {
      const res = await fetch(`${API_URL}/api/ong/mis-convocatorias/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (res.status === 401) {
        manejarSesionExpirada();
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'No se pudo cambiar el estado de la convocatoria.');
      }

      const NOMBRES_ESTADO = { ABIERTA: 'Abierta', COMPLETA: 'Cerrada', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
      const nombreVisible = NOMBRES_ESTADO[nuevoEstado.toUpperCase()] || nuevoEstado;
      showOk(`Estado actualizado a <strong>${nombreVisible}</strong> con éxito.`);
      await cargarConvocatorias(leerSesion());
      return;
    } catch (err) {
      return showError(err.message || 'Error al actualizar el estado.');
    }
  }

  // Fallback demo
  const item = convocatoriasCache.find(x => String(x.id) === String(id));
  if (item) {
    item.estado = nuevoEstado;
    localStorage.setItem('va_convocatorias_demo', JSON.stringify(convocatoriasCache));
    renderizarConvocatorias(convocatoriasCache);
    const NOMBRES_ESTADO = { ABIERTA: 'Abierta', COMPLETA: 'Cerrada', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
    showOk(`Estado actualizado a <strong>${NOMBRES_ESTADO[nuevoEstado.toUpperCase()] || nuevoEstado}</strong>.`);
  }
}

// ==========================================
// Gestión de Postulantes de la ONG
// ==========================================

function formatFecha(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(isoStr).slice(0, 10);
  }
}

function showModalPostulantesMsg(msg, isError = false) {
  const errEl = document.getElementById('postulantes-modal-error');
  const okEl = document.getElementById('postulantes-modal-ok');
  if (errEl) {
    errEl.textContent = isError ? msg : '';
    errEl.classList.toggle('hidden', !isError || !msg);
  }
  if (okEl) {
    okEl.textContent = !isError ? msg : '';
    okEl.classList.toggle('hidden', isError || !msg);
  }
}

async function abrirModalPostulantes(convocatoriaId) {
  const c = convocatoriasCache.find(x => String(x.id) === String(convocatoriaId));
  if (!c) return;

  convocatoriaActivaModal = c;
  subfiltroPostulanteActual = 'TODOS';
  showModalPostulantesMsg('');

  const modal = document.getElementById('modal-postulantes');
  const tituloEl = document.getElementById('postulantes-modal-titulo');
  const subtituloEl = document.getElementById('postulantes-modal-subtitulo');
  const tabs = document.getElementById('postulantes-tabs');

  if (tituloEl) tituloEl.textContent = `Postulantes: ${c.titulo}`;
  if (subtituloEl) {
    subtituloEl.textContent = `${c.cupos_totales ?? 10} cupos totales · Convocatoria: ${(c.estado || 'ABIERTA').toUpperCase()}`;
  }

  if (tabs) {
    tabs.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.subfiltro === 'TODOS');
    });
  }

  modal?.classList.remove('hidden');
  await cargarPostulantesModal(convocatoriaId);
}

function cerrarModalPostulantes() {
  document.getElementById('modal-postulantes')?.classList.add('hidden');
  showModalPostulantesMsg('');
  convocatoriaActivaModal = null;
}

async function cargarPostulantesModal(convocatoriaId) {
  const cont = document.getElementById('postulantes-lista-contenedor');
  if (cont) {
    cont.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Cargando postulantes...</p></div>';
  }

  const token = leerToken();
  if (token) {
    try {
      const res = await fetch(`${API_URL}/api/ong/convocatorias/${encodeURIComponent(convocatoriaId)}/postulaciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        manejarSesionExpirada();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        postulantesModalCache = data.postulaciones || [];
        renderizarPostulantesModal();
        return;
      }
    } catch (err) {
      console.warn('Error cargando postulantes desde API:', err);
    }
  }

  // Fallback demo
  try {
    const demoPosts = JSON.parse(localStorage.getItem('va_demo_postulaciones') || 'null') || [
      {
        id: 'post-1',
        voluntario_id: 'vol-1',
        nombre: 'Martín Gómez',
        email: 'martin.gomez@gmail.com',
        telefono: '11 4455-6677',
        estado: 'POSTULADO',
        created_at: new Date().toISOString()
      },
      {
        id: 'post-2',
        voluntario_id: 'vol-2',
        nombre: 'Lucía Fernández',
        email: 'lucia.f@hotmail.com',
        telefono: '11 9988-7766',
        estado: 'CONFIRMADO',
        created_at: new Date().toISOString()
      }
    ];
    postulantesModalCache = demoPosts;
  } catch {
    postulantesModalCache = [];
  }
  renderizarPostulantesModal();
}

function renderizarPostulantesModal() {
  const cont = document.getElementById('postulantes-lista-contenedor');
  if (!cont) return;

  const total = postulantesModalCache.length;
  const postulados = postulantesModalCache.filter(p => p.estado === 'POSTULADO').length;
  const confirmados = postulantesModalCache.filter(p => p.estado === 'CONFIRMADO').length;
  const asistieron = postulantesModalCache.filter(p => p.estado === 'ASISTIO').length;
  const cancelados = postulantesModalCache.filter(p => p.estado === 'CANCELADO').length;

  // Actualizar badges
  const bTodos = document.getElementById('subcount-todos');
  const bPostulado = document.getElementById('subcount-postulado');
  const bConfirmado = document.getElementById('subcount-confirmado');
  const bAsistio = document.getElementById('subcount-asistio');
  const bCancelado = document.getElementById('subcount-cancelado');

  if (bTodos) bTodos.textContent = total;
  if (bPostulado) bPostulado.textContent = postulados;
  if (bConfirmado) bConfirmado.textContent = confirmados;
  if (bAsistio) bAsistio.textContent = asistieron;
  if (bCancelado) bCancelado.textContent = cancelados;

  // Sincronizar el contador en la convocatoria activa
  if (convocatoriaActivaModal) {
    convocatoriaActivaModal.postulantes_count = postulados + confirmados;
    convocatoriaActivaModal.asistencias_pendientes = confirmados;
    const cardBadge = document.querySelector(`.convocatoria-card[data-id="${convocatoriaActivaModal.id}"] .btn-postulantes .count-badge`);
    if (cardBadge) cardBadge.textContent = postulados + confirmados;
    actualizarStats(convocatoriasCache);
  }

  const filtrados = subfiltroPostulanteActual === 'TODOS'
    ? postulantesModalCache
    : postulantesModalCache.filter(p => p.estado === subfiltroPostulanteActual);

  if (!filtrados || filtrados.length === 0) {
    const NOMBRES = {
      POSTULADO: 'pendientes',
      CONFIRMADO: 'confirmados',
      ASISTIO: 'que hayan asistido',
      CANCELADO: 'cancelados'
    };
    const estadoTxt = NOMBRES[subfiltroPostulanteActual] || '';
    cont.innerHTML = `
      <div class="empty-state" style="padding:28px 16px;">
        <div style="font-size:28px;margin-bottom:6px;">👥</div>
        <p style="margin:0;font-weight:600;color:var(--color-navy);">
          ${subfiltroPostulanteActual === 'TODOS' ? 'Aún no hay voluntarios postulados a esta convocatoria.' : `No hay voluntarios ${estadoTxt}.`}
        </p>
      </div>
    `;
    return;
  }

  cont.innerHTML = filtrados.map(p => {
    const rawEstado = (p.estado || 'POSTULADO').toUpperCase();
    let badgeClass = 'warn';
    let estadoLabel = 'Pendiente';

    if (rawEstado === 'CONFIRMADO') {
      badgeClass = 'success';
      estadoLabel = 'Confirmado';
    } else if (rawEstado === 'ASISTIO') {
      badgeClass = 'info';
      estadoLabel = 'Asistió';
    } else if (rawEstado === 'CANCELADO') {
      badgeClass = 'muted';
      estadoLabel = 'Cancelado';
    }

    let accionesHtml = '';
    if (rawEstado === 'POSTULADO') {
      accionesHtml = `
        <button type="button" class="btn-sm btn-cambiar-postulante" data-id="${esc(p.id)}" data-estado="CONFIRMADO" style="background:#1A7A5E;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">
          Confirmar
        </button>
        <button type="button" class="btn-sm btn-cambiar-postulante" data-id="${esc(p.id)}" data-estado="CANCELADO" style="background:#fff;color:#dc2626;border:1px solid #fca5a5;padding:6px 10px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">
          Rechazar
        </button>
      `;
    } else if (rawEstado === 'CONFIRMADO') {
      accionesHtml = `
        <button type="button" class="btn-sm btn-cambiar-postulante" data-id="${esc(p.id)}" data-estado="ASISTIO" style="background:#0284c7;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">
          Marcar Asistió
        </button>
        <button type="button" class="btn-sm btn-cambiar-postulante" data-id="${esc(p.id)}" data-estado="CANCELADO" style="background:#fff;color:#dc2626;border:1px solid #fca5a5;padding:6px 10px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">
          Cancelar
        </button>
      `;
    } else if (rawEstado === 'ASISTIO') {
      accionesHtml = `<span style="font-size:12px;font-weight:700;color:#0284c7;display:flex;align-items:center;gap:4px;">✓ Asistencia registrada</span>`;
    } else if (rawEstado === 'CANCELADO') {
      accionesHtml = `<span style="font-size:12px;font-weight:700;color:#94a3b8;display:flex;align-items:center;gap:4px;">✕ Cancelado</span>`;
    }

    return `
      <div class="postulante-item" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:12px;min-width:240px;">
          <div style="width:38px;height:38px;border-radius:50%;background:#e0f2fe;color:#0369a1;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">
            ${(p.nombre || 'V')[0].toUpperCase()}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong style="font-size:14.5px;color:#0f172a;">${esc(p.nombre)}</strong>
              <span class="badge ${badgeClass}" style="font-size:11px;">${estadoLabel}</span>
            </div>
            <div style="font-size:12.5px;color:#64748b;margin-top:2px;">
              ✉️ ${esc(p.email || 'Sin email')}${p.telefono ? ` · 📞 ${esc(p.telefono)}` : ''} · 📅 ${formatFecha(p.created_at)}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
          ${accionesHtml}
        </div>
      </div>
    `;
  }).join('');

  // Eventos de botones de acción
  cont.querySelectorAll('.btn-cambiar-postulante').forEach(btn => {
    btn.addEventListener('click', () => {
      ejecutarCambioEstadoPostulante(btn.dataset.id, btn.dataset.estado);
    });
  });
}

async function ejecutarCambioEstadoPostulante(postulacionId, nuevoEstado) {
  showModalPostulantesMsg('');
  const p = postulantesModalCache.find(x => String(x.id) === String(postulacionId));
  if (!p) return;

  const nombreVoluntario = p.nombre || 'el voluntario';

  if (nuevoEstado === 'CANCELADO') {
    const confirmar = await solicitarConfirmacion(`¿Estás seguro de que deseas cancelar/rechazar la postulación de "${nombreVoluntario}"? Una vez cancelada, no podrá volver a abrirse.`);
    if (!confirmar) return;
  } else if (nuevoEstado === 'ASISTIO') {
    const confirmar = await solicitarConfirmacion(`¿Confirmás que "${nombreVoluntario}" asistió a la convocatoria? Una vez registrado, el estado quedará finalizado.`);
    if (!confirmar) return;
  }

  const token = leerToken();
  if (token) {
    try {
      const res = await fetch(`${API_URL}/api/ong/postulaciones/${encodeURIComponent(postulacionId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (res.status === 401) {
        manejarSesionExpirada();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        p.estado = nuevoEstado;
        showModalPostulantesMsg(data.message || `Postulación actualizada a ${nuevoEstado}.`, false);
        renderizarPostulantesModal();
        return;
      }
      return showModalPostulantesMsg(data.message || 'Error al actualizar la postulación.', true);
    } catch (err) {
      return showModalPostulantesMsg(err.message || 'Error al conectar con el servidor.', true);
    }
  }

  // Fallback demo
  p.estado = nuevoEstado;
  localStorage.setItem('va_demo_postulaciones', JSON.stringify(postulantesModalCache));
  showModalPostulantesMsg(`Postulación actualizada a ${nuevoEstado}.`, false);
  renderizarPostulantesModal();
}

function activarEventosModalPostulantes() {
  const modal = document.getElementById('modal-postulantes');
  const btnCerrar = document.getElementById('btn-cerrar-postulantes');
  const tabs = document.getElementById('postulantes-tabs');

  btnCerrar?.addEventListener('click', cerrarModalPostulantes);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModalPostulantes();
  });

  tabs?.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nuevoSubfiltro = btn.dataset.subfiltro;
      if (subfiltroPostulanteActual === nuevoSubfiltro) return;
      subfiltroPostulanteActual = nuevoSubfiltro;
      tabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderizarPostulantesModal();
    });
  });
}
