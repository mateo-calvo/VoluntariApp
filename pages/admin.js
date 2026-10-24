// admin.js - Panel de administración conectado a la API de Django
const API_BASE = (typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000') + '/api';

let dashboardData = {
  metricas: { pendientes: 0, verificadas: 0, usuarios: 0, participaciones: 0 },
  ongs: [],
  usuarios: []
};

document.addEventListener('DOMContentLoaded', () => {
  const session = leerSesion();
  const token = sessionStorage.getItem('va_token');

  if (!session || session.rol !== 'admin' || !token) {
    window.location.href = 'login.html?next=admin.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
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

async function cargarDashboard() {
  const token = sessionStorage.getItem('va_token');
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

function pintarTodo() {
  const { metricas, ongs, usuarios } = dashboardData;

  const pendientes = [];
  const verificadas = [];

  ongs.forEach((o) => {
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
  set('st-usuarios', metricas?.usuarios ?? usuarios.length);
  set('st-parts', metricas?.participaciones ?? 0);

  pintarLista('ongs-pendientes', 'ongs-pendientes-vacio', pendientes, (o) =>
    tarjetaOng(
      o,
      `<button class="btn btn-primary btn-sm" data-aceptar="${esc(o.id)}" type="button">Aceptar ✓</button>
       <button class="btn btn-danger btn-sm" data-rechazar="${esc(o.id)}" type="button">Rechazar</button>`
    )
  );

  pintarLista('ongs-verificadas', 'ongs-verificadas-vacio', verificadas, (o) =>
    tarjetaOng(
      o,
      `<span class="badge">Verificada ✓</span>
       <button class="btn btn-secondary btn-sm" data-revocar="${esc(o.id)}" type="button">Revocar</button>`
    )
  );

  pintarLista('ongs-rechazadas', 'ongs-rechazadas-vacio', [], () => '');

  // Botones de acción
  document.querySelectorAll('[data-aceptar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstadoOng(b.dataset.aceptar, true, 'ONG aceptada. Ya figura verificada en el mapa.'))
  );

  document.querySelectorAll('[data-rechazar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstadoOng(b.dataset.rechazar, false, 'Solicitud de ONG rechazada.'))
  );

  document.querySelectorAll('[data-revocar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstadoOng(b.dataset.revocar, false, 'Verificación revocada. Vuelve a pendientes.'))
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
