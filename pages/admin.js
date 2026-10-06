// admin.js - Panel de administración (modo demo local)
document.addEventListener('DOMContentLoaded', () => {
  const session = leerSesion();
  if (!session || session.rol !== 'admin') {
    window.location.href = 'login.html?next=admin.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
  pintarTodo();
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

function leerOngs() {
  try {
    return JSON.parse(localStorage.getItem('va_ongs_demo') || '[]');
  } catch {
    return [];
  }
}

function leerUsuarios() {
  try {
    return JSON.parse(localStorage.getItem('va_users_demo') || '[]');
  } catch {
    return [];
  }
}

function leerParts() {
  try {
    return JSON.parse(localStorage.getItem('va_parts_demo') || '[]');
  } catch {
    return [];
  }
}

function guardarOngs(ongs) {
  localStorage.setItem('va_ongs_demo', JSON.stringify(ongs));
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function estadoDe(o) {
  if (o.estado === 'rechazada') return 'rechazada';
  if (o.verificada) return 'verificada';
  return 'pendiente';
}

function showOk(msg) {
  const box = document.getElementById('panel-ok');
  const err = document.getElementById('panel-error');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  err?.classList.add('hidden');
}

function tarjetaOng(o, idx, acciones) {
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
  const ongs = leerOngs();
  const pendientes = [];
  const verificadas = [];
  const rechazadas = [];
  ongs.forEach((o, i) => {
    const e = estadoDe(o);
    if (e === 'pendiente') pendientes.push([o, i]);
    else if (e === 'verificada') verificadas.push([o, i]);
    else rechazadas.push([o, i]);
  });

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set('st-pendientes', pendientes.length);
  set('st-verificadas', verificadas.length);
  set('st-usuarios', leerUsuarios().length);
  set('st-parts', leerParts().length);

  pintarLista('ongs-pendientes', 'ongs-pendientes-vacio', pendientes,
    ([o, i]) => tarjetaOng(o, i,
      `<button class="btn btn-primary btn-sm" data-aceptar="${i}" type="button">Aceptar ✓</button>
       <button class="btn btn-danger btn-sm" data-rechazar="${i}" type="button">Rechazar</button>`));
  pintarLista('ongs-verificadas', 'ongs-verificadas-vacio', verificadas,
    ([o, i]) => tarjetaOng(o, i,
      `<span class="badge">Verificada ✓</span>
       <button class="btn btn-secondary btn-sm" data-revocar="${i}" type="button">Revocar</button>`));
  pintarLista('ongs-rechazadas', 'ongs-rechazadas-vacio', rechazadas,
    ([o, i]) => tarjetaOng(o, i,
      `<span class="badge muted">Rechazada</span>
       <button class="btn btn-secondary btn-sm" data-revertir="${i}" type="button">Revertir</button>`));

  document.querySelectorAll('[data-aceptar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstado(Number(b.dataset.aceptar), { verificada: true, estado: 'verificada' }, 'ONG aceptada. Ya figura verificada en el mapa.')));
  document.querySelectorAll('[data-rechazar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstado(Number(b.dataset.rechazar), { verificada: false, estado: 'rechazada' }, 'ONG rechazada.')));
  document.querySelectorAll('[data-revocar]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstado(Number(b.dataset.revocar), { verificada: false, estado: 'pendiente' }, 'Verificación revocada. Vuelve a pendientes.')));
  document.querySelectorAll('[data-revertir]').forEach((b) =>
    b.addEventListener('click', () => cambiarEstado(Number(b.dataset.revertir), { verificada: false, estado: 'pendiente' }, 'Rechazo revertido. Vuelve a pendientes.')));

  const body = document.getElementById('users-body');
  if (body) {
    const users = leerUsuarios();
    body.innerHTML = users.length
      ? users.map((u) => `<tr><td>${esc(u.nombre || '-')}</td><td>${esc(u.email)}</td><td><span class="badge ${u.rol === 'admin' ? '' : 'muted'}">${esc(u.rol || 'voluntario')}</span></td></tr>`).join('')
      : '<tr><td colspan="3">Sin usuarios todavía.</td></tr>';
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

function cambiarEstado(i, patch, msg) {
  const ongs = leerOngs();
  if (!ongs[i]) return;
  ongs[i] = { ...ongs[i], ...patch };
  guardarOngs(ongs);
  showOk(msg);
  pintarTodo();
}
