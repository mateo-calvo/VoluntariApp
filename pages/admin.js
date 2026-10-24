// admin.js - Panel de administración conectado a la API de Django
const API_BASE = (typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000') + '/api';

let dashboardData = {
  metricas: { pendientes: 0, verificadas: 0, usuarios: 0, convocatorias: 0, participaciones: 0 },
  ongs: [],
  convocatorias: [],
  usuarios: []
};

let filtroActivo = 'todas';
let convocatoriaSeleccionadaId = null;

document.addEventListener('DOMContentLoaded', () => {
  const session = leerSesion();
  const token = sessionStorage.getItem('va_token');

  if (!session || session.rol !== 'admin' || !token) {
    window.location.href = 'login.html?next=admin.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
  activarFiltrosCards();
  activarModalConvocatoria();
  cargarDashboard();
});

function leerSesion() {
  try {
    return JSON.parse(sessionStorage.getItem('va_session') || 'null');
  } catch {
    return null;
  }
}

function pintarUsuario(session) {
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = session.nombre || session.email;
  if (avatarEl) avatarEl.textContent = ((session.nombre || session.email || 'A')[0] || 'A').toUpperCase();
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

function showOk(msg) {
  const box = document.getElementById('panel-ok');
  const err = document.getElementById('panel-error');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  err?.classList.add('hidden');
}

function showError(msg) {
  const box = document.getElementById('panel-error');
  const ok = document.getElementById('panel-ok');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  ok?.classList.add('hidden');
}

function mostrarLoading(mostrar) {
  const loadingEl = document.getElementById('panel-loading');
  if (loadingEl) {
    if (mostrar) {
      loadingEl.classList.remove('hidden');
    } else {
      loadingEl.classList.add('hidden');
    }
  }
}

function activarFiltrosCards() {
  document.querySelectorAll('.stat-card[data-filtro]').forEach((card) => {
    card.addEventListener('click', () => {
      aplicarFiltro(card.dataset.filtro);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        aplicarFiltro(card.dataset.filtro);
      }
    });
  });
}

function aplicarFiltro(nuevoFiltro) {
  if (filtroActivo === nuevoFiltro) {
    filtroActivo = 'todas';
  } else {
    filtroActivo = nuevoFiltro;
  }
  actualizarVistasPorFiltro();
}

function actualizarVistasPorFiltro() {
  document.querySelectorAll('.stat-card').forEach((card) => {
    card.classList.remove('active-filter');
    if (card.dataset.filtro === filtroActivo && filtroActivo !== 'todas') {
      card.classList.add('active-filter');
    }
  });

  const secPendientes = document.getElementById('sec-pendientes');
  const secVerificadas = document.getElementById('sec-verificadas');
  const secConvocatorias = document.getElementById('sec-convocatorias');
  const secUsuarios = document.getElementById('sec-usuarios');

  if (!secPendientes || !secVerificadas || !secConvocatorias || !secUsuarios) return;

  if (filtroActivo === 'todas') {
    secPendientes.classList.remove('hidden');
    secVerificadas.classList.remove('hidden');
    secConvocatorias.classList.remove('hidden');
    secUsuarios.classList.remove('hidden');
  } else if (filtroActivo === 'pendientes') {
    secPendientes.classList.remove('hidden');
    secVerificadas.classList.add('hidden');
    secConvocatorias.classList.add('hidden');
    secUsuarios.classList.add('hidden');
  } else if (filtroActivo === 'verificadas') {
    secPendientes.classList.add('hidden');
    secVerificadas.classList.remove('hidden');
    secConvocatorias.classList.add('hidden');
    secUsuarios.classList.add('hidden');
  } else if (filtroActivo === 'convocatorias') {
    secPendientes.classList.add('hidden');
    secVerificadas.classList.add('hidden');
    secConvocatorias.classList.remove('hidden');
    secUsuarios.classList.add('hidden');
  } else if (filtroActivo === 'usuarios') {
    secPendientes.classList.add('hidden');
    secVerificadas.classList.add('hidden');
    secConvocatorias.classList.add('hidden');
    secUsuarios.classList.remove('hidden');
  }
}

async function cargarDashboard() {
  const token = sessionStorage.getItem('va_token');
  mostrarLoading(true);
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('va_token');
      sessionStorage.removeItem('va_session');
      window.location.href = 'login.html?next=admin.html';
      return;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      showError(errData.message || 'Error al cargar los datos del panel de administración.');
      return;
    }

    dashboardData = await res.json();
    pintarTodo();
  } catch (error) {
    console.error('Error al conectar con la API de administración:', error);
    showError('No se pudo conectar con el servidor para obtener los datos del panel.');
  } finally {
    mostrarLoading(false);
  }
}

function tarjetaOng(o, acciones) {
  const nombre = esc(o.nombrePublico || o.razonSocial || 'ONG sin nombre');
  return `
    <article class="panel-card">
      <h3>🏢 ${nombre}</h3>
      <p class="meta">
        ${o.razonSocial ? `Razón social: <strong>${esc(o.razonSocial)}</strong><br>` : ''}
        ${o.cuit ? `CUIT: <strong>${esc(o.cuit)}</strong><br>` : ''}
        ${o.email ? `Email: <strong>${esc(o.email)}</strong><br>` : ''}
        ${o.barrio ? `📍 ${esc(o.barrio)}<br>` : ''}
        ${o.descripcion ? `${esc(o.descripcion)}<br>` : ''}
        ${o.web ? `🌐 <a href="${esc(o.web)}" target="_blank" rel="noopener">Sitio web</a> &nbsp;` : ''}
        ${o.contacto ? `✉️ ${esc(o.contacto)}` : ''}
      </p>
      <div class="row">${acciones}</div>
    </article>`;
}

function tarjetaConvocatoria(c) {
  let badgeClass = 'highlight';
  if (c.estado === 'ABIERTA') badgeClass = '';
  else if (c.estado === 'CANCELADA') badgeClass = 'muted';

  return `
    <article class="panel-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
        <h3 style="margin: 0; font-size: 18px;">🎯 ${esc(c.titulo)}</h3>
        <span class="badge ${badgeClass}">${esc(c.estado)}</span>
      </div>
      <p class="meta">
        🏢 ONG: <strong>${esc(c.ong_nombre)}</strong><br>
        🏷️ Causa: <strong>${esc(c.causa)}</strong> &nbsp;|&nbsp; 📍 ${esc(c.ubicacion || 'Sin ubicación')}<br>
        📅 Fecha: <strong>${esc(c.fecha || 'A coordinar')} ${esc(c.hora || '')}</strong> &nbsp;|&nbsp; 👥 Cupos: <strong>${c.cupos_disponibles}/${c.cupos_totales}</strong> libres<br>
        👥 Inscriptos: <strong>${c.total_postulantes || 0} voluntario(s)</strong>
        ${c.descripcion ? `<br><span style="color: var(--color-text); margin-top: 4px; display: inline-block;">${esc(c.descripcion)}</span>` : ''}
      </p>
      <div class="row" style="margin-top: 12px;">
        <button class="btn btn-primary btn-sm" data-ver-conv="${esc(c.id)}" type="button">👥 Ver participantes y gestionar</button>
      </div>
    </article>`;
}

function pintarTodo() {
  const { metricas, ongs, convocatorias, usuarios } = dashboardData;

  const pendientes = [];
  const verificadas = [];

  (ongs || []).forEach((o) => {
    if (o.verificada) {
      verificadas.push(o);
    } else {
      pendientes.push(o);
    }
  });

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  set('st-pendientes', metricas?.pendientes ?? pendientes.length);
  set('st-verificadas', metricas?.verificadas ?? verificadas.length);
  set('st-usuarios', metricas?.usuarios ?? (usuarios || []).length);
  set('st-convocatorias', metricas?.convocatorias ?? (convocatorias || []).length);

  // 1. ONGs pendientes
  pintarLista('ongs-pendientes', 'ongs-pendientes-vacio', pendientes, (o) =>
    tarjetaOng(
      o,
      `<button class="btn btn-primary btn-sm" data-aceptar="${esc(o.id)}" type="button">Aceptar ✓</button>
       <button class="btn btn-danger btn-sm" data-rechazar="${esc(o.id)}" type="button">Rechazar</button>`
    )
  );

  // 2. ONGs verificadas
  pintarLista('ongs-verificadas', 'ongs-verificadas-vacio', verificadas, (o) =>
    tarjetaOng(
      o,
      `<span class="badge">Verificada ✓</span>
       <button class="btn btn-secondary btn-sm" data-revocar="${esc(o.id)}" type="button">Revocar</button>`
    )
  );

  // 3. Convocatorias de la plataforma
  pintarLista('convocatorias-lista', 'convocatorias-vacio', convocatorias || [], tarjetaConvocatoria);

  // 4. ONGs rechazadas
  pintarLista('ongs-rechazadas', 'ongs-rechazadas-vacio', [], () => '');

  // Botones de acción ONGs
  document.querySelectorAll('[data-aceptar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstadoOng(b.dataset.aceptar, true, 'ONG aceptada. Ya figura verificada en el mapa.'))
  );

  document.querySelectorAll('[data-rechazar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstadoOng(b.dataset.rechazar, false, 'Solicitud de ONG rechazada.'))
  );

  document.querySelectorAll('[data-revocar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstadoOng(b.dataset.revocar, false, 'Verificación revocada. Vuelve a pendientes.'))
  );

  // Botones de convocatoria
  document.querySelectorAll('[data-ver-conv]').forEach((b) =>
    b.addEventListener('click', () => abrirModalConvocatoria(b.dataset.verConv))
  );

  // Tabla de usuarios
  const body = document.getElementById('users-body');
  if (body) {
    body.innerHTML = (usuarios && usuarios.length)
      ? usuarios.map((u) => {
          let badgeClass = 'muted';
          if (u.rol === 'admin') badgeClass = '';
          else if (u.rol === 'ong') badgeClass = 'highlight';

          return `<tr>
            <td>${esc(u.nombre || '-')}</td>
            <td>${esc(u.email || '-')}</td>
            <td><span class="badge ${badgeClass}">${esc(u.rol || 'voluntario')}</span></td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="3">Sin usuarios registrados.</td></tr>';
  }

  actualizarVistasPorFiltro();
}

function pintarLista(listId, emptyId, items, render) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  list.innerHTML = items.map(render).join('');
}

async function cambiarEstadoOng(ongId, nuevoEstado, mensajeExito) {
  const token = sessionStorage.getItem('va_token');
  try {
    const res = await fetch(`${API_BASE}/admin/ongs/${ongId}/verificar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ esta_verificada: nuevoEstado })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.message || 'Error al actualizar el estado de la organización.');
      return;
    }

    showOk(data.message || mensajeExito);
    await cargarDashboard();
  } catch (error) {
    console.error('Error al cambiar estado de ONG:', error);
    showError('Error de red al intentar actualizar la organización.');
  }
}

// ==========================================
// Modal Convocatoria y Participantes
// ==========================================
function activarModalConvocatoria() {
  const modal = document.getElementById('modal-convocatoria-admin');
  const btnCerrar = document.getElementById('btn-cerrar-modal-conv');
  const btnGuardarEstado = document.getElementById('btn-guardar-estado-conv');

  if (btnCerrar) {
    btnCerrar.addEventListener('click', cerrarModalConvocatoria);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModalConvocatoria();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      cerrarModalConvocatoria();
    }
  });

  if (btnGuardarEstado) {
    btnGuardarEstado.addEventListener('click', guardarEstadoConvocatoria);
  }
}

function cerrarModalConvocatoria() {
  const modal = document.getElementById('modal-convocatoria-admin');
  if (modal) modal.classList.add('hidden');
  convocatoriaSeleccionadaId = null;
}

async function abrirModalConvocatoria(convId) {
  convocatoriaSeleccionadaId = convId;
  const modal = document.getElementById('modal-convocatoria-admin');
  const loading = document.getElementById('modal-conv-loading');
  const tableWrap = document.getElementById('modal-conv-table-wrap');
  const vacio = document.getElementById('modal-conv-postulantes-vacio');
  const tbody = document.getElementById('modal-conv-postulantes-body');
  const errBox = document.getElementById('modal-conv-error');
  const okBox = document.getElementById('modal-conv-ok');

  errBox?.classList.add('hidden');
  okBox?.classList.add('hidden');
  tbody.innerHTML = '';
  tableWrap?.classList.remove('hidden');
  vacio?.classList.add('hidden');
  loading?.classList.remove('hidden');

  // Buscar datos básicos de la convocatoria en memoria
  const conv = (dashboardData.convocatorias || []).find((c) => c.id === convId);
  if (conv) {
    document.getElementById('modal-conv-titulo').textContent = conv.titulo;
    document.getElementById('modal-conv-subtitulo').textContent = `ID: ${conv.id}`;
    document.getElementById('modal-conv-descripcion').textContent = conv.descripcion || 'Sin descripción detallada.';
    document.getElementById('modal-conv-ong').innerHTML = `🏢 <strong>ONG:</strong> ${esc(conv.ong_nombre)}`;
    document.getElementById('modal-conv-causa').innerHTML = `🏷️ <strong>Causa:</strong> ${esc(conv.causa)}`;
    document.getElementById('modal-conv-fecha').innerHTML = `📅 <strong>Fecha:</strong> ${esc(conv.fecha || 'A coordinar')} ${esc(conv.hora || '')}`;
    document.getElementById('modal-conv-lugar').innerHTML = `📍 <strong>Lugar:</strong> ${esc(conv.ubicacion || 'Sin especificar')}`;
    document.getElementById('modal-conv-cupos').innerHTML = `👥 <strong>Cupos:</strong> ${conv.cupos_disponibles}/${conv.cupos_totales} libres`;

    const badge = document.getElementById('modal-conv-estado-badge');
    if (badge) {
      badge.textContent = conv.estado;
      badge.className = `badge ${conv.estado === 'ABIERTA' ? '' : (conv.estado === 'CANCELADA' ? 'muted' : 'highlight')}`;
    }

    const selectEstado = document.getElementById('select-estado-convocatoria');
    if (selectEstado) {
      selectEstado.value = conv.estado || 'ABIERTA';
    }
  }

  modal?.classList.remove('hidden');

  // Cargar postulantes desde el endpoint de administración
  const token = sessionStorage.getItem('va_token');
  try {
    const res = await fetch(`${API_BASE}/admin/convocatorias/${convId}/postulaciones`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    loading?.classList.add('hidden');

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (errBox) {
        errBox.textContent = err.message || 'Error al cargar los postulantes de esta convocatoria.';
        errBox.classList.remove('hidden');
      }
      return;
    }

    const data = await res.json();
    const postulantes = data.postulantes || [];

    if (!postulantes.length) {
      tableWrap?.classList.add('hidden');
      vacio?.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = postulantes.map((p) => {
      let bClass = 'highlight';
      const st = (p.estado || '').toUpperCase();
      if (st === 'CONFIRMADO' || st === 'ASISTIO') bClass = '';
      else if (st === 'CANCELADO' || st === 'RECHAZADO') bClass = 'muted';

      return `<tr>
        <td><strong>${esc(p.nombre)}</strong></td>
        <td>${esc(p.email)}<br><small style="color:var(--color-muted);">${esc(p.telefono || p.dni || '')}</small></td>
        <td>${esc(p.created_at || '-')}</td>
        <td><span class="badge ${bClass}">${esc(p.estado)}</span></td>
      </tr>`;
    }).join('');

  } catch (err) {
    loading?.classList.add('hidden');
    if (errBox) {
      errBox.textContent = 'Error de red al obtener los postulantes.';
      errBox.classList.remove('hidden');
    }
  }
}

async function guardarEstadoConvocatoria() {
  if (!convocatoriaSeleccionadaId) return;

  const select = document.getElementById('select-estado-convocatoria');
  const nuevoEstado = select?.value;
  const token = sessionStorage.getItem('va_token');
  const errBox = document.getElementById('modal-conv-error');
  const okBox = document.getElementById('modal-conv-ok');
  const btn = document.getElementById('btn-guardar-estado-conv');

  errBox?.classList.add('hidden');
  okBox?.classList.add('hidden');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/admin/convocatorias/${convocatoriaSeleccionadaId}/estado`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ estado: nuevoEstado })
    });

    const data = await res.json().catch(() => ({}));
    if (btn) btn.disabled = false;

    if (!res.ok) {
      if (errBox) {
        errBox.textContent = data.message || 'Error al actualizar el estado de la convocatoria.';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (okBox) {
      okBox.textContent = data.message || 'Estado actualizado con éxito.';
      okBox.classList.remove('hidden');
    }

    const badge = document.getElementById('modal-conv-estado-badge');
    if (badge) {
      badge.textContent = nuevoEstado;
      badge.className = `badge ${nuevoEstado === 'ABIERTA' ? '' : (nuevoEstado === 'CANCELADA' ? 'muted' : 'highlight')}`;
    }

    // Refrescar datos generales del dashboard
    await cargarDashboard();
  } catch (err) {
    if (btn) btn.disabled = false;
    if (errBox) {
      errBox.textContent = 'Error de conexión con el servidor.';
      errBox.classList.remove('hidden');
    }
  }
}
