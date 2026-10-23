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

async function pintarParticipaciones() {
  const list = document.getElementById('parts-list');
  const empty = document.getElementById('parts-empty');

  let parts = [];
  const token = sessionStorage.getItem('va_token');

  if (token) {
    try {
      const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl}/api/voluntario/mis-postulaciones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          parts = data.map((p) => ({
            id: String(p.convocatoria_id),
            nombre: p.titulo_convocatoria,
            organizacion: p.nombre_organizacion,
            barrio: p.lugar || '',
            fecha: p.created_at || p.fecha,
            estado: p.estado,
          }));

          // Sincronizar las activas en localStorage para el mapa
          const activas = parts
            .filter((p) => ['POSTULADO', 'CONFIRMADO'].includes(p.estado))
            .map((p) => ({ id: p.id, nombre: p.nombre, barrio: p.barrio, fecha: p.fecha }));
          localStorage.setItem('va_parts_demo', JSON.stringify(activas));
        }
      }
    } catch (e) {
      console.warn('Error al obtener mis postulaciones del servidor:', e);
      parts = leerParticipaciones();
    }
  } else {
    parts = leerParticipaciones();
  }

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
    const estado = p.estado || 'POSTULADO';
    const esActiva = ['POSTULADO', 'CONFIRMADO'].includes(estado);
    const badgeText = estado === 'CONFIRMADO' ? 'Confirmado ✓' : (estado === 'CANCELADO' ? 'Cancelado' : (estado === 'RECHAZADO' ? 'Rechazado' : 'Participando ✓'));
    const badgeStyle = !esActiva ? 'style="background:#95a5a6; color:#fff;"' : '';

    return `
      <article class="panel-card">
        <h3>🤝 ${nombre}</h3>
        <p class="meta">
          ${p.organizacion ? '🏢 <strong>' + esc(p.organizacion) + '</strong> &nbsp;·&nbsp; ' : ''}
          ${barrio ? '📍 ' + barrio + ' &nbsp;·&nbsp; ' : ''}
          ${fecha ? 'Anotado el ' + fecha : ''}
        </p>
        <div class="row">
          <span class="badge" ${badgeStyle}>${badgeText}</span>
          <a class="btn btn-secondary btn-sm" href="mapa.html?conv=${encodeURIComponent(id)}">Ver en mapa</a>
          ${esActiva ? `<button class="btn btn-danger btn-sm" data-anular="${esc(id)}" type="button">Anular</button>` : ''}
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

        const rest = leerParticipaciones().filter((p) => String(typeof p === 'string' ? p : p.id) !== String(id));
        localStorage.setItem('va_parts_demo', JSON.stringify(rest));
        if (ok) {
          ok.textContent = 'Participación anulada. El cupo vuelve a estar disponible.';
          ok.classList.remove('hidden');
        }
        pintarParticipaciones();
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
