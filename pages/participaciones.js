// participaciones.js - Panel del voluntario (modo demo local)
document.addEventListener('DOMContentLoaded', () => {
  const session = leerSesion();
  if (!session || session.rol !== 'voluntario') {
    window.location.href = 'login.html?next=participaciones.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
  pintarParticipaciones();
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

function pintarParticipaciones() {
  const list = document.getElementById('parts-list');
  const empty = document.getElementById('parts-empty');
  const parts = leerParticipaciones();

  if (!parts.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = parts.map((p) => {
    const id = typeof p === 'string' ? p : p.id;
    const nombre = typeof p === 'string' ? 'Convocatoria ' + esc(id) : esc(p.nombre || ('Convocatoria ' + id));
    const barrio = typeof p === 'string' ? '' : esc(p.barrio || '');
    const fecha = typeof p === 'string' ? '' : fechaCorta(p.fecha);
    return `
      <article class="panel-card">
        <h3>🤝 ${nombre}</h3>
        <p class="meta">${barrio ? '📍 ' + barrio + ' &nbsp;·&nbsp; ' : ''}${fecha ? 'Anotado el ' + fecha : ''}</p>
        <div class="row">
          <span class="badge">Participando ✓</span>
          <a class="btn btn-secondary btn-sm" href="mapa.html?conv=${encodeURIComponent(id)}">Ver en mapa</a>
          <button class="btn btn-danger btn-sm" data-anular="${esc(id)}" type="button">Anular</button>
        </div>
      </article>`;
  }).join('');

  list.querySelectorAll('[data-anular]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.anular;
      const rest = leerParticipaciones().filter((p) => String(typeof p === 'string' ? p : p.id) !== String(id));
      localStorage.setItem('va_parts_demo', JSON.stringify(rest));
      const ok = document.getElementById('panel-ok');
      if (ok) {
        ok.textContent = 'Participación anulada. El cupo vuelve a estar disponible.';
        ok.classList.remove('hidden');
      }
      pintarParticipaciones();
    });
  });
}
