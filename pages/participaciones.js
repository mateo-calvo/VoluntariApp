// participaciones.js - Panel del voluntario con filtros por estado
let todasLasParticipaciones = [];
let causasCache = [];
let filtroActual = 'participando';
let filtroNombre = '';
let filtroFecha = '';
let filtroCausaActual = '';
let ordenCronologico = 'fecha-asc';

document.addEventListener('DOMContentLoaded', async () => {
  const session = leerSesion();
  if (!session || session.rol !== 'voluntario') {
    window.location.href = 'login.html?next=participaciones.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
  activarFiltros();
  activarFiltrosBusqueda();
  await cargarCausas();
  await pintarParticipaciones();
});

function leerSesion() {
  try {
    return JSON.parse(sessionStorage.getItem('va_session') || 'null');
  } catch {
    return null;
  }
}

function manejarSesionExpirada() {
  sessionStorage.removeItem('va_token');
  sessionStorage.removeItem('va_session');
  window.location.href = 'login.html?expired=1&next=participaciones.html';
}

function pintarUsuario(session) {
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = session.nombre || session.email;
  if (avatarEl) avatarEl.textContent = ((session.nombre || session.email || 'V')[0] || 'V').toUpperCase();
}

function activarSalir() {
  document.getElementById('logout-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem('va_token');
    sessionStorage.removeItem('va_session');
    window.location.href = '../index.html';
  });
}

function activarFiltros() {
  const filterBtns = document.querySelectorAll('#status-filters .filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filtroActual = btn.dataset.filtro;
      renderizarLista();
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
    renderizarLista();
  });

  inputFecha?.addEventListener('change', (e) => {
    filtroFecha = e.target.value;
    if (filtroFecha) {
      btnLimpiarFecha?.classList.remove('hidden');
    } else {
      btnLimpiarFecha?.classList.add('hidden');
    }
    renderizarLista();
  });

  btnLimpiarFecha?.addEventListener('click', () => {
    if (inputFecha) inputFecha.value = '';
    filtroFecha = '';
    btnLimpiarFecha.classList.add('hidden');
    renderizarLista();
  });

  const selectCausa = document.getElementById('filtro-causa');
  selectCausa?.addEventListener('change', (e) => {
    filtroCausaActual = e.target.value;
    renderizarLista();
  });

  selectOrden?.addEventListener('change', (e) => {
    ordenCronologico = e.target.value;
    renderizarLista();
  });
}

async function cargarCausas() {
  const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
  try {
    const res = await fetch(`${baseUrl}/api/causas/`);
    if (res.ok) {
      causasCache = await res.json();
    }
  } catch (e) {
    console.warn('Error al cargar causas:', e);
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

  const selectCausa = document.getElementById('filtro-causa');
  if (selectCausa) {
    selectCausa.innerHTML = '<option value="">Todas las causas</option>' +
      causasCache.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }
}

function leerParticipaciones() {
  try {
    return JSON.parse(localStorage.getItem('va_parts_demo') || '[]');
  } catch {
    return [];
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
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

function clasificarParticipacion(p) {
  const estPost = (p.estado || 'POSTULADO').toUpperCase();
  const estConv = (p.estadoConvocatoria || 'ABIERTA').toUpperCase();

  // Canceladas (si el voluntario canceló o si la ONG canceló la convocatoria)
  if (estPost === 'CANCELADO' || estConv === 'CANCELADA') {
    return {
      filtro: 'cancelada',
      badgeText: estConv === 'CANCELADA' ? 'Convocatoria cancelada' : 'Postulación cancelada',
      badgeStyle: 'style="background:#e74c3c; color:#fff;"',
      puedeAnular: false,
    };
  }

  // Finalizadas (si la convocatoria concluyó o el voluntariado ya finalizó / asistió)
  if (estConv === 'FINALIZADA' || estPost === 'FINALIZADO' || estPost === 'ASISTIO') {
    return {
      filtro: 'finalizada',
      badgeText: estPost === 'ASISTIO' ? 'Asistió ✓' : 'Finalizada',
      badgeStyle: 'style="background:#0284c7; color:#fff;"',
      puedeAnular: false,
    };
  }

  // Confirmado (participación confirmada)
  if (estPost === 'CONFIRMADO') {
    return {
      filtro: 'participando',
      badgeText: 'Confirmado ✓',
      badgeStyle: 'style="background:#27ae60; color:#fff;"',
      puedeAnular: true,
    };
  }

  // Pendiente de aprobación por parte de la ONG
  return {
    filtro: 'participando',
    badgeText: 'Pendiente de aprobación',
    badgeStyle: 'style="background:#d97706; color:#fff;"',
    puedeAnular: true,
  };
}

async function pintarParticipaciones() {
  const token = sessionStorage.getItem('va_token');

  if (token) {
    try {
      const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl}/api/voluntario/mis-postulaciones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        manejarSesionExpirada();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          todasLasParticipaciones = data.map((p) => {
            const item = {
              id: String(p.convocatoria_id),
              nombre: p.titulo_convocatoria,
              organizacion: p.nombre_organizacion,
              causaNombre: p.causa_nombre || '',
              causaId: p.causa_id || null,
              barrio: p.lugar || '',
              fechaEvento: p.fecha || '',
              horaEvento: p.hora || '',
              fechaPostulacion: p.created_at || '',
              estado: p.estado,
              estadoConvocatoria: p.estado_convocatoria || 'ABIERTA',
            };
            item.clasificacion = clasificarParticipacion(item);
            return item;
          });

          // Sincronizar activas para el mapa
          const activas = todasLasParticipaciones
            .filter((p) => p.clasificacion.filtro === 'participando')
            .map((p) => ({ id: p.id, nombre: p.nombre, barrio: p.barrio, fecha: p.fecha }));
          localStorage.setItem('va_parts_demo', JSON.stringify(activas));
        }
      }
    } catch (e) {
      console.warn('Error al obtener mis postulaciones del servidor:', e);
      todasLasParticipaciones = leerParticipaciones().map((p) => {
        const item = {
          id: typeof p === 'string' ? p : p.id,
          nombre: typeof p === 'string' ? 'Convocatoria ' + p : (p.nombre || 'Convocatoria ' + p.id),
          barrio: typeof p === 'string' ? '' : (p.barrio || ''),
          fecha: typeof p === 'string' ? '' : (p.fecha || ''),
          estado: 'POSTULADO',
          estadoConvocatoria: 'ABIERTA',
        };
        item.clasificacion = clasificarParticipacion(item);
        return item;
      });
    }
  } else {
    todasLasParticipaciones = leerParticipaciones().map((p) => {
      const item = {
        id: typeof p === 'string' ? p : p.id,
        nombre: typeof p === 'string' ? 'Convocatoria ' + p : (p.nombre || 'Convocatoria ' + p.id),
        barrio: typeof p === 'string' ? '' : (p.barrio || ''),
        fecha: typeof p === 'string' ? '' : (p.fecha || ''),
        estado: 'POSTULADO',
        estadoConvocatoria: 'ABIERTA',
      };
      item.clasificacion = clasificarParticipacion(item);
      return item;
    });
  }

  renderizarLista();
}

function renderizarLista() {
  const list = document.getElementById('parts-list');
  const empty = document.getElementById('parts-empty');

  // 1. Filtrar por estado
  let filtradas = todasLasParticipaciones.filter((p) => {
    if (filtroActual === 'todas') return true;
    return p.clasificacion.filtro === filtroActual;
  });

  // 2. Filtrar por nombre (título, organización o barrio)
  if (filtroNombre && filtroNombre.trim() !== '') {
    const term = filtroNombre.trim().toLowerCase();
    filtradas = filtradas.filter((p) => {
      const nom = (p.nombre || '').toLowerCase();
      const org = (p.organizacion || '').toLowerCase();
      const bar = (p.barrio || '').toLowerCase();
      return nom.includes(term) || org.includes(term) || bar.includes(term);
    });
  }

  // 3. Filtrar por fecha exacta del evento
  if (filtroFecha && filtroFecha.trim() !== '') {
    filtradas = filtradas.filter((p) => {
      const fecha = p.fechaEvento || p.fecha;
      if (!fecha) return false;
      return String(fecha).startsWith(filtroFecha);
    });
  }

  // 4. Filtrar por causa
  if (filtroCausaActual) {
    filtradas = filtradas.filter((p) => {
      if (p.causaId && String(p.causaId) === String(filtroCausaActual)) return true;
      const causaObj = causasCache.find(x => String(x.id) === String(filtroCausaActual));
      const nombreCausaBuscada = causaObj ? causaObj.nombre.toLowerCase() : '';
      if (p.causaNombre && nombreCausaBuscada && p.causaNombre.toLowerCase().includes(nombreCausaBuscada)) return true;
      return false;
    });
  }

  // 4. Ordenar cronológicamente o alfabéticamente
  filtradas.sort((a, b) => {
    if (ordenCronologico === 'alfabetico') {
      return (a.nombre || '').localeCompare(b.nombre || '');
    }

    const fechaA = a.fechaEvento || a.fecha || (ordenCronologico === 'fecha-asc' ? '9999-12-31' : '0000-00-00');
    const horaA = a.horaEvento || '00:00';
    const fechaB = b.fechaEvento || b.fecha || (ordenCronologico === 'fecha-asc' ? '9999-12-31' : '0000-00-00');
    const horaB = b.horaEvento || '00:00';

    const dtA = `${fechaA}T${horaA}`;
    const dtB = `${fechaB}T${horaB}`;

    if (ordenCronologico === 'fecha-desc') {
      return dtB.localeCompare(dtA);
    }
    // Por defecto 'fecha-asc' (más próximas primero)
    return dtA.localeCompare(dtB);
  });

  if (!filtradas.length) {
    list.innerHTML = '';
    if (empty) {
      if (filtroNombre || filtroFecha || filtroCausaActual) {
        empty.innerHTML = `No se encontraron participaciones con los filtros aplicados.<br><button type="button" class="btn btn-secondary btn-sm" id="btn-limpiar-busqueda" style="margin-top:12px; cursor:pointer;">Limpiar filtros de búsqueda</button>`;
        empty.querySelector('#btn-limpiar-busqueda')?.addEventListener('click', () => {
          const inNombre = document.getElementById('filtro-nombre');
          const inFecha = document.getElementById('filtro-fecha');
          const selCausa = document.getElementById('filtro-causa');
          const btnClear = document.getElementById('btn-limpiar-fecha');
          if (inNombre) inNombre.value = '';
          if (inFecha) inFecha.value = '';
          if (selCausa) selCausa.value = '';
          btnClear?.classList.add('hidden');
          filtroNombre = '';
          filtroFecha = '';
          filtroCausaActual = '';
          renderizarLista();
        });
      } else if (filtroActual === 'finalizada') {
        empty.innerHTML = `No asististe a ninguna convocatoria.<br><a href="mapa.html" class="btn btn-primary" style="margin-top:12px; display:inline-block;">Explorar el mapa</a>`;
      } else {
        const etiquetas = {
          participando: 'en curso / participando',
          cancelada: 'canceladas',
          todas: 'en tu cuenta',
        };
        empty.innerHTML = `No tenés convocatorias ${etiquetas[filtroActual] || ''}.<br><a href="mapa.html" class="btn btn-primary" style="margin-top:12px; display:inline-block;">Explorar el mapa</a>`;
      }
      empty.classList.remove('hidden');
    }
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = filtradas.map((p) => {
    const id = p.id;
    const nombre = esc(p.nombre);
    const barrio = esc(p.barrio || '');
    const fechaAnotado = fechaCorta(p.fechaPostulacion || p.fecha);
    const fechaEvento = formatearFechaHora(p.fechaEvento, p.horaEvento);
    const info = p.clasificacion;

    return `
      <article class="panel-card">
        <h3>🤝 ${nombre}</h3>
        <p class="meta">
          ${p.organizacion ? '🏢 <strong>' + esc(p.organizacion) + '</strong> &nbsp;·&nbsp; ' : ''}
          ${p.causaNombre ? '<span class="badge muted" style="font-size:11px; padding:2px 8px; vertical-align:middle;">' + esc(p.causaNombre) + '</span> &nbsp;·&nbsp; ' : ''}
          ${barrio ? '📍 ' + barrio + '<br>' : ''}
          📅 <strong>Fecha:</strong> ${esc(fechaEvento)}
          ${fechaAnotado ? ' &nbsp;·&nbsp; <small style="color:var(--color-muted);">Inscripto el ' + fechaAnotado + '</small>' : ''}
        </p>
        <div class="row">
          <span class="badge" ${info.badgeStyle}>${info.badgeText}</span>
          <a class="btn btn-secondary btn-sm" href="mapa.html?conv=${encodeURIComponent(id)}">Ver en mapa</a>
          ${info.puedeAnular ? `<button class="btn btn-danger btn-sm" data-anular="${esc(id)}" type="button">Anular</button>` : ''}
        </div>
      </article>`;
  }).join('');

  list.querySelectorAll('[data-anular]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.anular;
      const card = btn.closest('.panel-card');
      const nombre = card ? card.querySelector('h3')?.textContent.replace(/^🤝\s*/, '') : 'esta convocatoria';

      confirmarCancelacionModal(nombre, async () => {
        const ok = document.getElementById('panel-ok');
        const errEl = document.getElementById('panel-error');
        if (ok) ok.classList.add('hidden');
        if (errEl) errEl.classList.add('hidden');

        btn.disabled = true;
        btn.textContent = 'Anulando...';

        const token = sessionStorage.getItem('va_token');
        if (token) {
          try {
            const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
            const res = await fetch(`${baseUrl}/api/convocatorias/${encodeURIComponent(id)}/participar`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              }
            });
            if (res.status === 401) {
              manejarSesionExpirada();
              return;
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(data.message || 'No se pudo cancelar la participación.');
            }
          } catch (err) {
            if (errEl) {
              errEl.textContent = err.message || 'Error al conectar con el servidor.';
              errEl.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = 'Anular';
            throw err;
          }
        }

        // Marcar localmente como cancelada
        const target = todasLasParticipaciones.find((p) => String(p.id) === String(id));
        if (target) {
          target.estado = 'CANCELADO';
          target.clasificacion = clasificarParticipacion(target);
        }

        const rest = leerParticipaciones().filter((p) => String(typeof p === 'string' ? p : p.id) !== String(id));
        localStorage.setItem('va_parts_demo', JSON.stringify(rest));
        if (ok) {
          ok.textContent = 'Participación anulada. El cupo vuelve a estar disponible.';
          ok.classList.remove('hidden');
        }
        renderizarLista();
      });
    });
  });
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

  const safeTitulo = esc(titulo || 'esta convocatoria');

  modal.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
      <div style="width:40px; height:40px; border-radius:50%; background:#fee2e2; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
        ⚠️
      </div>
      <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:#0f172a;">¿Cancelar postulación?</h3>
    </div>
    <p style="margin:0 0 20px 0; font-size:0.95rem; line-height:1.5; color:#475569;">
      ¿Estás seguro de que querés cancelar tu postulación a <strong>"${safeTitulo}"</strong>? Tu lugar quedará disponible para otro voluntario.
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
