// mi-ong.js - Panel de la ONG (modo demo local)
document.addEventListener('DOMContentLoaded', () => {
  const session = leerSesion();
  if (!session || session.rol !== 'ong') {
    window.location.href = 'login.html?next=mi-ong.html';
    return;
  }

  pintarUsuario(session);
  activarSalir();
  cargarFicha(session);
  activarGuardado(session);
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

function leerOngs() {
  try {
    return JSON.parse(localStorage.getItem('va_ongs_demo') || '[]');
  } catch {
    return [];
  }
}

function guardarOngs(ongs) {
  localStorage.setItem('va_ongs_demo', JSON.stringify(ongs));
}

function miFicha(session) {
  const ongs = leerOngs();
  let ficha = ongs.find((o) => o.ownerEmail === session.email || o.email === session.email);
  if (!ficha) {
    // Cuenta demo sin ficha: se crea una base editable al guardar
    ficha = {
      ownerEmail: session.email,
      nombrePublico: session.nombre || 'Mi ONG',
      email: session.email,
      categoria: 'desarrollo-social',
      barrio: '',
      descripcion: '',
      necesidades: '',
      web: '',
      linkPago: '',
      contacto: session.email,
      cupos: 5,
      verificada: true,
      esDemo: true,
    };
  }
  return ficha;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v || '';
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
  box.textContent = msg;
  box.classList.remove('hidden');
  err?.classList.add('hidden');
}

function validUrl(v) {
  if (!v) return true;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

function cargarFicha(session) {
  const ficha = miFicha(session);
  setVal('f-nombre', ficha.nombrePublico);
  setVal('f-categoria', ficha.categoria);
  setVal('f-barrio', ficha.barrio);
  setVal('f-descripcion', ficha.descripcion);
  setVal('f-necesidades', ficha.necesidades);
  setVal('f-web', ficha.web);
  setVal('f-pago', ficha.linkPago);
  setVal('f-contacto', ficha.contacto);
  setVal('f-cupos', ficha.cupos ?? 5);

  const badge = document.getElementById('ong-estado');
  if (badge && ficha.verificada === false) badge.classList.remove('hidden');

  const cuenta = document.getElementById('ong-cuenta');
  if (cuenta) {
    cuenta.innerHTML =
      `Razón social: <strong>${esc(ficha.razonSocial || ficha.nombrePublico)}</strong><br>` +
      (ficha.cuit ? `CUIT: <strong>${esc(ficha.cuit)}</strong><br>` : '') +
      `Email: <strong>${esc(session.email)}</strong>`;
  }
}

function activarGuardado(session) {
  document.getElementById('ong-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('f-nombre').value.trim();
    const categoria = document.getElementById('f-categoria').value;
    const barrio = document.getElementById('f-barrio').value.trim();
    const descripcion = document.getElementById('f-descripcion').value.trim();
    const necesidades = document.getElementById('f-necesidades').value.trim();
    const web = document.getElementById('f-web').value.trim();
    const linkPago = document.getElementById('f-pago').value.trim();
    const contacto = document.getElementById('f-contacto').value.trim();
    const cupos = Math.max(1, Math.min(500, Number(document.getElementById('f-cupos').value) || 5));

    if (nombre.length < 3) return showError('El nombre público debe tener al menos 3 caracteres.');
    if (!barrio) return showError('Indicá el barrio o localidad.');
    if (descripcion.length < 10) return showError('La descripción debe tener al menos 10 caracteres.');
    if (!validUrl(web)) return showError('El sitio web debe empezar con https://');
    if (!validUrl(linkPago)) return showError('El link de donación debe empezar con https://');
    if (!contacto) return showError('Indicá un contacto.');

    const ongs = leerOngs();
    const i = ongs.findIndex((o) => o.ownerEmail === session.email || o.email === session.email);
    const base = i >= 0 ? ongs[i] : { ownerEmail: session.email, email: session.email, verificada: true };
    const actualizada = {
      ...base,
      ownerEmail: session.email,
      nombrePublico: nombre,
      categoria,
      barrio,
      descripcion,
      necesidades,
      web,
      linkPago,
      contacto,
      cupos,
    };
    // Sin coordenadas propias se ubica en CABA para que figure en el mapa
    if (actualizada.lat === undefined) actualizada.lat = -34.6037;
    if (actualizada.lng === undefined) actualizada.lng = -58.3816;
    if (i >= 0) ongs[i] = actualizada;
    else ongs.push(actualizada);
    guardarOngs(ongs);

    // Refresca el nombre visible en la sesión
    try {
      const s = leerSesion();
      s.nombre = nombre;
      sessionStorage.setItem('va_session', JSON.stringify(s));
      pintarUsuario(s);
    } catch { /* noop */ }

    showOk('Ficha guardada. Ya se refleja en el mapa.');
  });
}
