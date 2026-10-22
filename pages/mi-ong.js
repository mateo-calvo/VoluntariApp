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
  activarAutocompletado();
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
    const isCruzRoja = session.email === 'contacto@cruzroja.org.ar' || (session.nombre && session.nombre.toLowerCase().includes('cruz roja'));
    ficha = {
      ownerEmail: session.email,
      nombrePublico: session.nombre || (isCruzRoja ? 'Cruz Roja Argentina' : 'Mi ONG'),
      email: session.email,
      categoria: isCruzRoja ? 'salud' : 'desarrollo-social',
      barrio: isCruzRoja ? 'Av. Las Heras 2214, Palermo, CABA' : 'Av. Corrientes 1234, CABA',
      lat: isCruzRoja ? -34.5731 : -34.6037,
      lng: isCruzRoja ? -58.4220 : -58.3816,
      descripcion: isCruzRoja
        ? 'Atención en emergencias, primeros auxilios y puestos sanitarios.'
        : 'Organización comunitaria dedicada al voluntariado.',
      necesidades: 'Voluntarios para campañas y colectas comunitarias.',
      web: isCruzRoja ? 'https://cruzroja.org.ar' : '',
      linkPago: isCruzRoja ? 'https://mpago.la/cruzrojaargentina' : '',
      contacto: session.email,
      cupos: 12,
      verificada: true,
      esDemo: true,
    };
  }

  // Si existe una modificación previa de ubicación en localStorage, sincronizarla
  try {
    const override = JSON.parse(localStorage.getItem('va_demo_ong_override') || 'null');
    if (override) {
      if (override.barrio) ficha.barrio = override.barrio;
      if (override.lat != null) ficha.lat = Number(override.lat);
      if (override.lng != null) ficha.lng = Number(override.lng);
      if (override.nombre) ficha.nombrePublico = override.nombre;
      if (override.linkPago) ficha.linkPago = override.linkPago;
    }
  } catch {}

  return ficha;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
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

function validUrl(v) {
  if (!v) return true;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

function activarAutocompletado() {
  const inputBarrio = document.getElementById('f-barrio');
  const inputLat = document.getElementById('f-lat');
  const inputLng = document.getElementById('f-lng');

  if (window.conectarAutocompletadoUbicacion && inputBarrio) {
    window.conectarAutocompletadoUbicacion(inputBarrio, {
      lista: '#f-barrio-sugerencias',
      onSelect: (item, info) => {
        if (inputLat) inputLat.value = info.lat;
        if (inputLng) inputLng.value = info.lon;
      },
      onInput: () => {
        // Al escribir manualmente, se limpian las coordenadas previas para evitar desincronización
        if (inputLat) inputLat.value = '';
        if (inputLng) inputLng.value = '';
      }
    });
  }
}

function cargarFicha(session) {
  const ficha = miFicha(session);
  setVal('f-nombre', ficha.nombrePublico);
  setVal('f-categoria', ficha.categoria);
  setVal('f-barrio', ficha.barrio);
  if (ficha.lat !== undefined && ficha.lat !== null) setVal('f-lat', ficha.lat);
  if (ficha.lng !== undefined && ficha.lng !== null) setVal('f-lng', ficha.lng);
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
  document.getElementById('ong-form')?.addEventListener('submit', async (e) => {
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

    const btnGuardar = document.getElementById('ong-guardar');
    if (btnGuardar) {
      btnGuardar.disabled = true;
      btnGuardar.textContent = 'Guardando y geolocalizando...';
    }

    let latVal = parseFloat(document.getElementById('f-lat')?.value);
    let lngVal = parseFloat(document.getElementById('f-lng')?.value);

    // Si las coordenadas no se completaron desde el dropdown de autocompletado, geocodificar con Nominatim
    if (isNaN(latVal) || isNaN(lngVal)) {
      try {
        const query = encodeURIComponent(`${barrio}, Argentina`);
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
          headers: { 'Accept-Language': 'es' }
        });
        const geoData = await geoRes.json();
        if (Array.isArray(geoData) && geoData.length > 0) {
          latVal = parseFloat(geoData[0].lat);
          lngVal = parseFloat(geoData[0].lon);
          const inputLat = document.getElementById('f-lat');
          const inputLng = document.getElementById('f-lng');
          if (inputLat) inputLat.value = latVal;
          if (inputLng) inputLng.value = lngVal;
        }
      } catch (err) {
        console.warn('Geocodificación fallback:', err);
      }
    }

    if (isNaN(latVal) || isNaN(lngVal)) {
      latVal = -34.6037;
      lngVal = -58.3816;
    }

    const ongs = leerOngs();
    const i = ongs.findIndex((o) => o.ownerEmail === session.email || o.email === session.email);
    const base = i >= 0 ? ongs[i] : { ownerEmail: session.email, email: session.email, verificada: true };
    const actualizada = {
      ...base,
      ownerEmail: session.email,
      nombrePublico: nombre,
      categoria,
      barrio,
      lat: latVal,
      lng: lngVal,
      descripcion,
      necesidades,
      web,
      linkPago,
      contacto,
      cupos,
    };

    if (i >= 0) ongs[i] = actualizada;
    else ongs.push(actualizada);
    guardarOngs(ongs);

    // Guardar en override del mapa
    const demoOverride = {
      email: session.email,
      nombre: nombre,
      barrio: barrio,
      lat: latVal,
      lng: lngVal,
      categoria: categoria,
      web: web,
      linkPago: linkPago,
      descripcion: descripcion,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('va_demo_ong_override', JSON.stringify(demoOverride));

    // Refresca el nombre visible en la sesión
    try {
      const s = leerSesion();
      s.nombre = nombre;
      sessionStorage.setItem('va_session', JSON.stringify(s));
      pintarUsuario(s);
    } catch { /* noop */ }

    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar cambios';
    }

    showOk('¡Ficha guardada! La nueva ubicación (<strong>' + esc(barrio) + '</strong>) ya se actualizó en el mapa. <a href="mapa.html" style="margin-left:8px;font-weight:700;text-decoration:underline;">Ver en el mapa →</a>');
  });
}
