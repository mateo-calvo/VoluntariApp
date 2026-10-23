// mis-convocatorias.js - Gestión de convocatorias de la ONG
const API_URL = window.API_URL || 'http://127.0.0.1:8000';

let convocatoriasCache = [];
let causasCache = [];
let provinciasCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const session = leerSesion();
  if (!session || session.rol !== 'ong') {
    window.location.href = 'login.html?next=mis-convocatorias.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
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

  try {
    const res = await fetch(`${API_URL}/api/causas/`);
    if (res.ok) {
      causasCache = await res.json();
    }
  } catch (err) {
    console.warn('No se pudieron cargar causas desde API, usando respaldo:', err);
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
}

async function cargarProvincias() {
  const selectProv = document.getElementById('c-provincia');
  if (!selectProv) return;

  try {
    const res = await fetch(`${API_URL}/api/provincias/`);
    if (res.ok) {
      provinciasCache = await res.json();
      selectProv.innerHTML = '<option value="" disabled selected>Selecciona una provincia</option>' +
        provinciasCache.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
    }
  } catch (err) {
    console.warn('Error cargando provincias:', err);
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
    const res = await fetch(`${API_URL}/api/localidades/?provincia_id=${encodeURIComponent(provId)}`);
    if (res.ok) {
      const data = await res.json();
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

  actualizarStats(lista);

  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <h3>Aún no tenés convocatorias publicadas</h3>
        <p>Hacé clic en el botón superior para crear tu primera oportunidad de voluntariado.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = lista.map((c) => {
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

    return `
      <article class="convocatoria-card" data-id="${esc(c.id)}">
        <div class="convocatoria-top">
          <div>
            <h3 class="convocatoria-title">${esc(c.titulo)}</h3>
            <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
              <span class="badge ${badgeClass}">${estadoLabel}</span>
              <span class="badge muted">${esc(causaTxt)}</span>
            </div>
          </div>
        </div>

        <div class="convocatoria-meta">
          ${c.fecha ? `<span>📅 ${esc(c.fecha)}${c.hora ? ' - ' + esc(c.hora).slice(0,5) + ' hs' : ''}</span>` : ''}
          ${c.lugar || c.direccion ? `<span>📍 ${esc(c.lugar || c.direccion)}${c.localidad_nombre ? ' (' + esc(c.localidad_nombre) + ')' : ''}</span>` : ''}
          <span>👥 ${esc(c.cupos_totales ?? 10)} cupos</span>
          ${c.horas_estimadas ? `<span>⏱️ ${esc(c.horas_estimadas)} hs</span>` : ''}
        </div>

        ${c.descripcion ? `<p class="convocatoria-desc">${esc(c.descripcion)}</p>` : ''}

        <div class="convocatoria-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-editar" data-id="${esc(c.id)}">
            ✏️ Editar
          </button>

          <label style="font-size:13px;font-weight:700;color:var(--color-muted);margin-left:auto;display:flex;align-items:center;gap:6px;">
            Estado:
            <select class="select-estado-rapido" data-id="${esc(c.id)}" style="padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;font-family:inherit;font-size:13px;font-weight:600;background:#fff;cursor:pointer;">
              <option value="ABIERTA" ${rawEstado === 'ABIERTA' ? 'selected' : ''}>Abierta</option>
              <option value="COMPLETA" ${rawEstado === 'COMPLETA' ? 'selected' : ''}>Cerrada</option>
              <option value="FINALIZADA" ${rawEstado === 'FINALIZADA' ? 'selected' : ''}>Finalizada</option>
              <option value="CANCELADA" ${rawEstado === 'CANCELADA' ? 'selected' : ''}>Cancelada</option>
            </select>
          </label>
        </div>
      </article>
    `;
  }).join('');

  // Eventos de botones en tarjetas
  contenedor.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditar(btn.dataset.id));
  });

  contenedor.querySelectorAll('.select-estado-rapido').forEach(sel => {
    sel.dataset.prev = sel.value;
    sel.addEventListener('focus', () => {
      sel.dataset.prev = sel.value;
    });
    sel.addEventListener('change', async () => {
      const nuevoEstado = sel.value;
      const prevEstado = sel.dataset.prev || 'ABIERTA';
      const NOMBRES_ESTADO = { ABIERTA: 'Abierta', COMPLETA: 'Cerrada', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
      const nombreVisible = NOMBRES_ESTADO[nuevoEstado.toUpperCase()] || nuevoEstado;

      const confirmar = await solicitarConfirmacion(`¿Estás seguro de que deseas cambiar el estado de esta convocatoria a "${nombreVisible}"?`);
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
  const abiertas = lista.filter(c => (c.estado || 'ABIERTA').toUpperCase() === 'ABIERTA').length;
  const total = lista.length;
  const cupos = lista
    .filter(c => (c.estado || 'ABIERTA').toUpperCase() === 'ABIERTA')
    .reduce((acc, c) => acc + (Number(c.cupos_totales) || 0), 0);

  const elActivas = document.getElementById('stat-activas');
  const elTotal = document.getElementById('stat-total');
  const elCupos = document.getElementById('stat-cupos');

  if (elActivas) elActivas.textContent = abiertas;
  if (elTotal) elTotal.textContent = total;
  if (elCupos) elCupos.textContent = cupos;
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
    if (estado !== estadoPrevio) {
      const NOMBRES_ESTADO = { ABIERTA: 'Abierta', COMPLETA: 'Cerrada', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
      const nombreVisible = NOMBRES_ESTADO[estado] || estado;
      const confirmar = await solicitarConfirmacion(`¿Estás seguro de que deseas cambiar el estado de esta convocatoria a "${nombreVisible}"?`);
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
    requiere_aprobacion: false,
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
