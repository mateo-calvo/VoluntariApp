// register.js - Registro de VoluntariApp (Voluntario / ONG)
// Usa la API (server/) si está disponible; si no, modo demo local.
// El registro ONG guarda la ficha para que aparezca en el mapa.

document.addEventListener('DOMContentLoaded', () => {
    const btnVoluntario = document.getElementById('btn-voluntario');
    const btnOng = document.getElementById('btn-ong');

    const camposVoluntario = document.getElementById('campos-voluntario');
    const camposOng = document.getElementById('campos-ong');

    const botonEnviar = document.getElementById('boton-enviar');
    const btnTexto = botonEnviar ? botonEnviar.querySelector('.btn-text') : null;
    const formulario = document.getElementById('formulario-registro');
    const errorBox = document.getElementById('register-error');
    const okBox = document.getElementById('register-ok');

    // Campos de voluntario
    const inputNombre = document.getElementById('nombre');
    const inputApellido = document.getElementById('apellido');
    const inputDni = document.getElementById('dni');
    const inputTelefono = document.getElementById('telefono');
    const selectGenero = document.getElementById('genero');
    const inputFechaNac = document.getElementById('fecha_nacimiento');
    const selectProvincia = document.getElementById('provincia_id');
    const selectLocalidad = document.getElementById('localidad_id');
    const inputDireccion = document.getElementById('direccion');
    const inputEmailVol = document.getElementById('email');
    const inputPassVol = document.getElementById('password');

    // ---------- Carga dinámica de Provincias y Localidades (Django API) ----------
    async function inicializarCascadaUbicacion(selectProv, selectLoc) {
        if (!selectProv) return;
        try {
            const res = await fetch(`${API_URL}/api/provincias/`);
            if (!res.ok) throw new Error('Error al obtener provincias');
            const data = await res.json();

            selectProv.innerHTML = '<option value="" disabled selected>Selecciona tu provincia</option>';
            data.forEach((p) => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.nombre;
                selectProv.appendChild(opt);
            });
        } catch (err) {
            console.error('Error cargando provincias:', err);
            selectProv.innerHTML = '<option value="" disabled selected>Error al cargar provincias</option>';
        }

        selectProv.addEventListener('change', async () => {
            const provId = selectProv.value;
            if (!selectLoc) return;

            selectLoc.disabled = true;
            selectLoc.innerHTML = '<option value="" disabled selected>Cargando localidades...</option>';

            if (!provId) return;

            try {
                const res = await fetch(`${API_URL}/api/localidades/?provincia_id=${encodeURIComponent(provId)}`);
                if (!res.ok) throw new Error('Error al obtener localidades');
                const data = await res.json();

                selectLoc.innerHTML = '<option value="" disabled selected>Selecciona tu localidad</option>';
                data.forEach((loc) => {
                    const opt = document.createElement('option');
                    opt.value = loc.id;
                    opt.textContent = loc.nombre;
                    selectLoc.appendChild(opt);
                });
                selectLoc.disabled = false;
            } catch (err) {
                console.error('Error cargando localidades:', err);
                selectLoc.innerHTML = '<option value="" disabled selected>Error al cargar localidades</option>';
            }
        });
    }

    inicializarCascadaUbicacion(selectProvincia, selectLocalidad);

    // Campos de ONG
    const inputRazonSocial = document.getElementById('razon-social');
    const inputCuit = document.getElementById('cuit');
    const inputEmailOng = document.getElementById('email-ong');
    const selectOngProvincia = document.getElementById('ong_provincia_id');
    const selectOngLocalidad = document.getElementById('ong_localidad_id');
    const inputDomicilio = document.getElementById('domicilio');
    const inputCp = document.getElementById('cp');
    const inputPassOng = document.getElementById('password-ong');

    inicializarCascadaUbicacion(selectOngProvincia, selectOngLocalidad);
    const inputCategoria = document.getElementById('categoria-ong');
    const inputBarrio = document.getElementById('barrio-ong');
    const inputLat = document.getElementById('lat-ong');
    const inputLng = document.getElementById('lng-ong');
    const sugList = document.getElementById('ubicacion-sugerencias');
    const elegidaBox = document.getElementById('ubicacion-elegida');
    const ubicacionError = document.getElementById('ubicacion-error');
    const fallbackBox = document.getElementById('ubicacion-fallback');
    const inputBarrioManual = document.getElementById('barrio-ong-manual');
    const inputDescripcion = document.getElementById('descripcion-ong');
    const inputNecesidades = document.getElementById('necesidades-ong');
    const inputWeb = document.getElementById('web-ong');
    const inputPago = document.getElementById('pago-ong');
    const inputContacto = document.getElementById('contacto-ong');

    const BARRIOS_COORDS = {
        'Palermo, CABA': [-34.5731, -58.422],
        'Recoleta, CABA': [-34.5884, -58.393],
        'Belgrano, CABA': [-34.5627, -58.4568],
        'Villa Crespo, CABA': [-34.599, -58.445],
        'Retiro, CABA': [-34.5917, -58.3731],
        'Puerto Madero, CABA': [-34.6083, -58.3625],
        'San Telmo, CABA': [-34.6214, -58.3735],
        'La Boca, CABA': [-34.6345, -58.3632],
        'Barracas, CABA': [-34.6475, -58.3853],
        'Flores, CABA': [-34.629, -58.459],
        'Flores Sur, CABA': [-34.645, -58.445],
        'Villa Lugano, CABA': [-34.677, -58.47],
    };

    // ---------- Autocompletado de ubicación (Nominatim / OpenStreetMap) ----------
    // Un mismo motor alimenta dos campos: Ubicación y Domicilio legal.
    // La selección (de cualquiera) fija las coordenadas compartidas del mapa.
    const ubicacionCache = {};
    let ubicacionTimer = null;
    let ubicacionAbort = null;
    let sugItems = [];
    let sugActive = -1;
    let ubicacionSeq = 0;
    let listaAbierta = null;
    const domList = document.getElementById('domicilio-sugerencias');
    const dirList = document.getElementById('direccion-sugerencias');

    function etiquetaUbicacion(r) {
        const a = r.address || {};
        const calle = [a.road, a.house_number].filter(Boolean).join(' ');
        const zona = a.suburb || a.neighbourhood || a.city_district || a.quarter || '';
        const ciudad = a.city || a.town || a.village || a.municipality || '';
        const prov = a.state || '';
        // Con calle: "Sarmiento 377, Lomas de Zamora, Buenos Aires".
        // Sin calle: "Lomitas, Lomas de Zamora, Buenos Aires".
        const partes = calle
            ? [calle, ciudad || zona, prov]
            : [zona, ciudad, prov];
        const etiqueta = [...new Set(partes.filter(Boolean))].join(', ')
            || r.display_name.split(',').slice(0, 3).join(',').trim();
        const detalle = r.display_name.split(',').slice(1, 4).join(',').trim();
        return { etiqueta, detalle };
    }

    function cerrarSugerencias() {
        [sugList, domList, dirList].forEach((l) => {
            if (!l) return;
            l.innerHTML = '';
            l.classList.add('hidden');
        });
        inputBarrio?.setAttribute('aria-expanded', 'false');
        inputDomicilio?.setAttribute('aria-expanded', 'false');
        inputDireccion?.setAttribute('aria-expanded', 'false');
        listaAbierta = null;
        sugItems = [];
        sugActive = -1;
    }

    function pintarSugerencias(items, lista, input) {
        if (!lista) return;
        cerrarSugerencias();
        listaAbierta = lista;
        sugItems = items;
        sugActive = -1;
        if (!items.length) {
            lista.innerHTML = '<li class="sug-estado">Sin resultados. Probá con calle y altura o barrio.</li>';
        } else {
            lista.innerHTML = items.map((it, i) => {
                const t = etiquetaUbicacion(it);
                return `<li role="option" id="sug-${i}" data-i="${i}" aria-selected="false">
                    <span class="sug-titulo">${t.etiqueta}</span>
                    <span class="sug-detalle">${t.detalle}</span>
                </li>`;
            }).join('');
        }
        lista.classList.remove('hidden');
        input?.setAttribute('aria-expanded', 'true');
    }

    function marcarActiva() {
        if (!listaAbierta) return;
        listaAbierta.querySelectorAll('li[data-i]').forEach((li) => {
            const on = Number(li.dataset.i) === sugActive;
            li.classList.toggle('active', on);
            li.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }

    function fijarCoordenadas(item, etiqueta) {
        if (inputLat) inputLat.value = item.lat;
        if (inputLng) inputLng.value = item.lon;
        if (inputBarrio) {
            inputBarrio.value = etiqueta;
            inputBarrio.dataset.etiqueta = etiqueta;
        }
        if (elegidaBox) {
            elegidaBox.textContent = `📍 Ubicación seleccionada: ${etiqueta}`;
            elegidaBox.classList.remove('hidden');
        }
        if (ubicacionError) ubicacionError.classList.add('hidden');
    }

    function elegirUbicacion(item, origen) {
        const t = etiquetaUbicacion(item);
        if (origen === 'dir') {
            if (inputDireccion) inputDireccion.value = t.etiqueta;
            cerrarSugerencias();
            return;
        }
        if (origen === 'dom') {
            // Elegida desde Domicilio: la etiqueta ya trae calle + zona
            if (inputDomicilio) {
                inputDomicilio.value = t.etiqueta;
            }
            fijarCoordenadas(item, t.etiqueta);
        } else {
            fijarCoordenadas(item, t.etiqueta);
            // Si el domicilio legal está vacío, se pre-rellena con lo elegido
            if (inputDomicilio && !inputDomicilio.value.trim()) {
                inputDomicilio.value = t.etiqueta;
            }
        }
        cerrarSugerencias();
    }

    function mostrarErrorUbicacion(msg, conFallback) {
        if (ubicacionError) {
            ubicacionError.textContent = msg;
            ubicacionError.classList.remove('hidden');
        }
        if (conFallback && fallbackBox) fallbackBox.classList.remove('hidden');
    }

    async function buscarUbicacion(q, lista, input) {
        if (ubicacionCache[q]) {
            pintarSugerencias(ubicacionCache[q], lista, input);
            return;
        }
        const mySeq = ++ubicacionSeq;
        const vigente = () => mySeq === ubicacionSeq;
        if (ubicacionAbort) ubicacionAbort.abort();
        ubicacionAbort = new AbortController();
        // Señal de actividad + timeout: sin esto, una red colgada deja la lista vacía para siempre
        if (lista) {
            cerrarSugerencias();
            listaAbierta = lista;
            lista.innerHTML = '<li class="sug-estado">Buscando ubicaciones…</li>';
            lista.classList.remove('hidden');
            input?.setAttribute('aria-expanded', 'true');
        }
        const watchdog = setTimeout(() => {
            try { ubicacionAbort.abort(); } catch { /* noop */ }
        }, 8000);
        // 1) Nominatim (OpenStreetMap)
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=es&countrycodes=ar&limit=6&q=${encodeURIComponent(q)}`;
            const res = await fetch(url, {
                signal: ubicacionAbort.signal,
                headers: { Accept: 'application/json' },
            });
            clearTimeout(watchdog);
            if (!vigente()) return;
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            ubicacionCache[q] = Array.isArray(data) ? data : [];
            pintarSugerencias(ubicacionCache[q], lista, input);
            return;
        } catch (err) {
            clearTimeout(watchdog);
            if (!vigente()) return; // un tipeo nuevo ya tomó el control
            // timeout del watchdog o error de red: se sigue al respaldo
        }
        // 2) Respaldo: Photon (Komoot, también datos OSM)
        const watchdog2 = setTimeout(() => {
            try { ubicacionAbort.abort(); } catch { /* noop */ }
        }, 8000);
        try {
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ', Argentina')}&limit=6`;
            const res = await fetch(url, { signal: ubicacionAbort.signal });
            clearTimeout(watchdog2);
            if (!vigente()) return;
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            ubicacionCache[q] = (data.features || []).map(normalizarPhoton);
            pintarSugerencias(ubicacionCache[q], lista, input);
            return;
        } catch (err) {
            clearTimeout(watchdog2);
            if (!vigente()) return;
        }
        // 3) Sin conexión: selector manual de barrios
        cerrarSugerencias();
        mostrarErrorUbicacion('No se pudo buscar ubicaciones (sin conexión). Elegí tu barrio abajo.', true);
    }

    function normalizarPhoton(f) {
        const p = f.properties || {};
        const coords = (f.geometry && f.geometry.coordinates) || [0, 0];
        const partes = [p.name, p.street, p.district || p.locality, p.city, p.state, p.country].filter(Boolean);
        return {
            lat: String(coords[1]),
            lon: String(coords[0]),
            display_name: partes.join(', '),
            address: {
                suburb: p.district || p.locality || '',
                city: p.city || '',
                state: p.state || '',
                road: p.street || '',
                house_number: p.housenumber || '',
            },
        };
    }

    function invalidarSeleccion() {
        if (inputLat) inputLat.value = '';
        if (inputLng) inputLng.value = '';
        if (inputBarrio && inputBarrio.dataset) delete inputBarrio.dataset.etiqueta;
        if (elegidaBox) elegidaBox.classList.add('hidden');
    }

    function conectarBuscador(input, lista, origen) {
        if (!input || !lista) return;
        input.addEventListener('input', () => {
            // Editar cualquier campo invalida la selección anterior
            invalidarSeleccion();
            const q = input.value.trim();
            clearTimeout(ubicacionTimer);
            if (q.length < 3) {
                cerrarSugerencias();
                return;
            }
            ubicacionTimer = setTimeout(() => buscarUbicacion(q, lista, input), 450);
        });

        input.addEventListener('keydown', (e) => {
            const opciones = listaAbierta === lista ? lista.querySelectorAll('li[data-i]') : [];
            if (!opciones.length) {
                if (e.key === 'Escape') cerrarSugerencias();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                sugActive = (sugActive + 1) % opciones.length;
                marcarActiva();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                sugActive = (sugActive - 1 + opciones.length) % opciones.length;
                marcarActiva();
            } else if (e.key === 'Enter' && sugActive >= 0) {
                e.preventDefault();
                elegirUbicacion(sugItems[sugActive], origen);
            } else if (e.key === 'Escape') {
                cerrarSugerencias();
            }
        });

        lista.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-i]');
            if (li && sugItems[Number(li.dataset.i)]) {
                elegirUbicacion(sugItems[Number(li.dataset.i)], origen);
            }
        });
    }

    conectarBuscador(inputBarrio, sugList, 'ubi');
    conectarBuscador(inputDomicilio, domList, 'dom');
    conectarBuscador(inputDireccion, dirList, 'dir');

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ubicacion-box')) cerrarSugerencias();
    });

    function leerUbicacion() {
        // 1) Selección del buscador
        if (inputLat?.value && inputLng?.value && inputBarrio?.dataset?.etiqueta) {
            return {
                barrio: inputBarrio.dataset.etiqueta,
                lat: Number(inputLat.value),
                lng: Number(inputLng.value),
            };
        }
        // 2) Fallback manual por barrio
        if (fallbackBox && !fallbackBox.classList.contains('hidden') && inputBarrioManual) {
            const barrio = inputBarrioManual.value;
            const [lat, lng] = BARRIOS_COORDS[barrio] || [-34.6037, -58.3816];
            return { barrio, lat, lng };
        }
        return null;
    }

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
        okBox?.classList.add('hidden');
        errorBox.scrollIntoView({ block: 'nearest' });
    }

    function showOk(msg) {
        if (!okBox) return;
        okBox.textContent = msg;
        okBox.classList.remove('hidden');
        errorBox?.classList.add('hidden');
    }

    // ---------- Pasos del formulario ONG ----------
    const ongPaso1 = document.getElementById('ong-paso-1');
    const ongPaso2 = document.getElementById('ong-paso-2');
    const stepNav = document.getElementById('step-nav');
    const btnSiguiente = document.getElementById('btn-siguiente');
    const btnVolver = document.getElementById('btn-volver');
    const pasoFinal = document.getElementById('paso-final');

    function goStep(n) {
        const isStep2 = n === 2;
        if (ongPaso1) ongPaso1.style.display = isStep2 ? 'none' : '';
        if (ongPaso2) ongPaso2.style.display = isStep2 ? '' : 'none';
        if (pasoFinal) pasoFinal.style.display = isStep2 ? '' : 'none';
        if (btnSiguiente) btnSiguiente.classList.toggle('hidden', isStep2);
        if (btnVolver) btnVolver.classList.toggle('hidden', !isStep2);
        errorBox?.classList.add('hidden');
        syncRequired();
        const authContent = document.querySelector('.auth-content');
        if (authContent) authContent.scrollTop = 0;
    }

    // Los required solo valen en campos visibles: si un required queda en un
    // paso oculto, el navegador bloquea el envío y la validación propia no corre.
    const checkboxTerminos = document.getElementById('terminos');
    function syncRequired() {
        const ongMode = btnOng && btnOng.classList.contains('active');
        const paso2Visible = !ongMode || (ongPaso2 && ongPaso2.style.display !== 'none');
        const paso1Visible = ongMode && (ongPaso1 && ongPaso1.style.display !== 'none');

        [inputRazonSocial, inputCuit, inputEmailOng, selectOngProvincia, inputDomicilio, inputCp, inputPassOng].forEach((i) => {
            if (i) i.required = !!paso1Visible;
        });

        if (inputDescripcion) inputDescripcion.required = !!(ongMode && paso2Visible);
        if (inputContacto) inputContacto.required = !!(ongMode && paso2Visible);
        if (checkboxTerminos) checkboxTerminos.required = !ongMode || !!paso2Visible;
    }

    function validarPaso1() {
        if (inputRazonSocial.value.trim().length < 3) {
            return 'Ingresa la razón social de la organización.';
        }
        if (!CUIT_RE.test(inputCuit.value.trim())) {
            return 'El CUIT debe tener formato 30-12345678-9.';
        }
        if (!inputEmailOng.checkValidity() || !inputEmailOng.value.trim()) {
            return 'Ingresa un email institucional válido.';
        }
        if (!selectOngProvincia || !selectOngProvincia.value) {
            return 'Selecciona la provincia de la organización.';
        }
        if (!selectOngLocalidad || !selectOngLocalidad.value) {
            return 'Selecciona la localidad de la organización.';
        }
        if (!inputDomicilio.value.trim() || !inputCp.value.trim()) {
            return 'Completa el domicilio legal y el código postal.';
        }
        if (inputPassOng.value.length < 6) {
            return 'La contraseña debe tener al menos 6 caracteres.';
        }
        if (!leerUbicacion()) {
            return 'Buscá tu ubicación y elegí una opción de la lista.';
        }
        return null;
    }

    if (btnSiguiente) btnSiguiente.addEventListener('click', () => {
        const error = validarPaso1();
        if (error) {
            showError(error);
            return;
        }
        goStep(2);
    });

    if (btnVolver) btnVolver.addEventListener('click', () => goStep(1));

    function activarVoluntario() {
        btnVoluntario.classList.add('active');
        btnVoluntario.setAttribute('aria-selected', 'true');
        btnOng.classList.remove('active');
        btnOng.setAttribute('aria-selected', 'false');

        camposVoluntario.style.display = 'flex';
        camposOng.style.display = 'none';
        if (stepNav) stepNav.style.display = 'none';
        if (pasoFinal) pasoFinal.style.display = '';
        // Vuelve al paso 1 por si se cambia de modo a mitad del wizard
        if (ongPaso1) ongPaso1.style.display = '';
        if (ongPaso2) ongPaso2.style.display = 'none';

        const camposVoluntarioInputs = [
            inputNombre, inputApellido, inputDni, inputTelefono, selectGenero,
            inputFechaNac, selectProvincia, selectLocalidad, inputDireccion,
            inputEmailVol, inputPassVol
        ];
        const camposOngInputs = [
            inputRazonSocial, inputCuit, inputEmailOng, selectOngProvincia, selectOngLocalidad,
            inputDomicilio, inputCp, inputPassOng
        ];

        camposVoluntarioInputs.forEach((i) => { if (i) i.required = true; });
        camposOngInputs.forEach((i) => { if (i) i.required = false; });

        if (btnTexto) btnTexto.textContent = 'Crear cuenta gratis';
        syncRequired();
    }

    function activarOng() {
        btnOng.classList.add('active');
        btnOng.setAttribute('aria-selected', 'true');
        btnVoluntario.classList.remove('active');
        btnVoluntario.setAttribute('aria-selected', 'false');

        camposOng.style.display = 'flex';
        camposVoluntario.style.display = 'none';
        if (stepNav) stepNav.style.display = '';
        goStep(1);

        const camposVoluntarioInputs = [
            inputNombre, inputApellido, inputDni, inputTelefono, selectGenero,
            inputFechaNac, selectProvincia, selectLocalidad, inputDireccion,
            inputEmailVol, inputPassVol
        ];
        const camposOngInputs = [
            inputRazonSocial, inputCuit, inputEmailOng, selectOngProvincia, selectOngLocalidad,
            inputDomicilio, inputCp, inputPassOng
        ];

        camposVoluntarioInputs.forEach((i) => { if (i) i.required = false; });
        camposOngInputs.forEach((i) => { if (i) i.required = true; });

        if (btnTexto) btnTexto.textContent = 'Enviar solicitud de registro';
    }

    if (btnVoluntario) btnVoluntario.addEventListener('click', activarVoluntario);
    if (btnOng) btnOng.addEventListener('click', activarOng);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tipo') === 'ong') {
        activarOng();
    } else {
        activarVoluntario();
    }

    // Ojitos de contraseña
    function setupPasswordToggle(buttonSelector, inputId) {
        const toggleBtn = document.querySelector(buttonSelector);
        const passInput = document.getElementById(inputId);
        if (!toggleBtn || !passInput) return;
        const eyeOpen = toggleBtn.querySelector('.eye-open');
        const eyeClosed = toggleBtn.querySelector('.eye-closed');
        toggleBtn.addEventListener('click', () => {
            const isPassword = passInput.type === 'password';
            passInput.type = isPassword ? 'text' : 'password';
            if (eyeOpen && eyeClosed) {
                eyeOpen.style.display = isPassword ? 'none' : 'block';
                eyeClosed.style.display = isPassword ? 'block' : 'none';
            }
            toggleBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
        });
    }

    setupPasswordToggle('.toggle-password-voluntario', 'password');
    setupPasswordToggle('.toggle-password-ong', 'password-ong');

    const CUIT_RE = /^\d{2}-\d{8}-\d$/;

    // POST contra la API si existe; si no hay backend (hosting estático,
    // pendrive, file://) lanza TypeError para usar el modo demo local.
    async function apiPost(path, payload) {
        let res;
        try {
            res = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(5000),
            });
        } catch {
            throw new TypeError('sin backend');
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new TypeError('sin backend');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.message || 'No se pudo completar la operación.');
            err.status = res.status;
            throw err;
        }
        return data;
    }

    function validUrl(value) {
        if (!value) return true;
        try {
            const u = new URL(value);
            return u.protocol === 'https:';
        } catch {
            return false;
        }
    }

    // Envío del formulario
    if (formulario) {
        formulario.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorBox?.classList.add('hidden');
            okBox?.classList.add('hidden');

            const isOng = btnOng.classList.contains('active');
            const submitBtn = document.getElementById('boton-enviar');
            const originalContent = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>${isOng ? 'Enviando solicitud...' : 'Creando cuenta...'}</span>`;

            try {
                if (!isOng) {
                    const nombre = inputNombre ? inputNombre.value.trim() : '';
                    const apellido = inputApellido ? inputApellido.value.trim() : '';
                    const dni = inputDni ? inputDni.value.trim() : '';
                    const telefono = inputTelefono ? inputTelefono.value.trim() : '';
                    const genero = selectGenero ? selectGenero.value : '';
                    const fecha_nacimiento = inputFechaNac ? inputFechaNac.value : '';
                    const provincia_id = selectProvincia ? parseInt(selectProvincia.value, 10) : 0;
                    const localidad_id = selectLocalidad ? parseInt(selectLocalidad.value, 10) : 0;
                    const direccion = inputDireccion ? inputDireccion.value.trim() : '';
                    const email = inputEmailVol ? inputEmailVol.value.trim().toLowerCase() : '';
                    const password = inputPassVol ? inputPassVol.value : '';

                    if (!nombre || !apellido) throw new Error('Ingresa tu nombre y apellido completos.');
                    if (!dni) throw new Error('Ingresa tu DNI o documento.');
                    if (!telefono) throw new Error('Ingresa tu número de teléfono.');
                    if (!genero) throw new Error('Selecciona tu género.');
                    if (!fecha_nacimiento) throw new Error('Ingresa tu fecha de nacimiento.');
                    if (!provincia_id) throw new Error('Selecciona tu provincia.');
                    if (!localidad_id) throw new Error('Selecciona tu localidad.');
                    if (!direccion) throw new Error('Ingresa tu dirección.');
                    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

                    const res = await fetch(`${API_URL}/api/auth/register-voluntario`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            nombre,
                            apellido,
                            dni,
                            telefono,
                            genero,
                            fecha_nacimiento,
                            provincia_id,
                            localidad_id,
                            direccion,
                            email,
                            password,
                        }),
                    });

                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(json.message || 'Error al crear la cuenta.');
                    }

                    showOk('¡Cuenta creada con éxito! Te llevamos al inicio de sesión…');
                    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
                } else {
                    const razon = inputRazonSocial.value.trim();
                    const cuit = inputCuit.value.trim();
                    const email = inputEmailOng.value.trim().toLowerCase();
                    const domicilio = inputDomicilio.value.trim();
                    const cp = inputCp.value.trim();
                    const password = inputPassOng.value;
                    const categoria = inputCategoria?.value || 'desarrollo-social';
                    const ubi = leerUbicacion();
                    if (!ubi) throw new Error('Buscá tu ubicación y elegí una opción de la lista.');
                    const { barrio, lat, lng } = ubi;
                    const descripcion = inputDescripcion?.value.trim() || '';
                    const necesidades = inputNecesidades?.value.trim() || '';
                    const web = inputWeb?.value.trim() || '';
                    const linkPago = inputPago?.value.trim() || '';
                    const contacto = inputContacto?.value.trim() || '';

                    if (razon.length < 3) throw new Error('Ingresa la razón social de la organización.');
                    if (!CUIT_RE.test(cuit)) throw new Error('El CUIT debe tener formato 30-12345678-9.');
                    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
                    if (descripcion.length < 10) throw new Error('Contanos en al menos 10 caracteres qué hace tu organización.');
                    if (!validUrl(web)) throw new Error('El sitio web debe empezar con https://');
                    if (!validUrl(linkPago)) throw new Error('El link de donación debe empezar con https://');

                    const provId = selectOngProvincia && selectOngProvincia.value ? parseInt(selectOngProvincia.value, 10) : null;
                    const locId = selectOngLocalidad && selectOngLocalidad.value ? parseInt(selectOngLocalidad.value, 10) : null;
                    if (!provId) throw new Error('Selecciona la provincia de la organización.');
                    if (!locId) throw new Error('Selecciona la localidad de la organización.');

                    const payload = {
                        razonSocial: razon, cuit, email, domicilio, cp, password,
                        nombrePublico: razon, categoria, barrio, descripcion,
                        necesidades, web, linkPago, contacto, lat, lng,
                        provincia_id: provId,
                        localidad_id: locId,
                    };

                    const res = await fetch(`${API_URL}/api/auth/register-ong`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(json.message || 'Error al enviar la solicitud de registro.');
                    }

                    showOk('¡Solicitud enviada! Revisaremos tu documentación en 48 hs hábiles.');
                    setTimeout(() => { window.location.href = 'login.html'; }, 1800);
                }
            } catch (err) {
                showError(err.message || 'Ocurrió un error. Intenta de nuevo.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        });
    }
});
