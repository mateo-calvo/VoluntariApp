/**
 * ubicacion-autocomplete.js
 * Módulo reutilizable de autocompletado de direcciones con OpenStreetMap (Nominatim)
 * y respaldo en Photon (Komoot), idéntico al del registro de ONG.
 */
(function (global) {
    'use strict';

    const ubicacionCache = {};
    let globalInstId = 0;

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
            || (r.display_name ? r.display_name.split(',').slice(0, 3).join(',').trim() : '');
        const detalle = r.display_name ? r.display_name.split(',').slice(1, 4).join(',').trim() : '';
        return { etiqueta, detalle };
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

    /**
     * Conecta el autocompletado de direcciones a un input.
     * @param {HTMLInputElement|string} inputRef - Input o selector
     * @param {Object} [opciones] - Opciones de configuración y callbacks
     * @returns {Object|null} Controlador del autocompletado
     */
    function conectarAutocompletadoUbicacion(inputRef, opciones = {}) {
        const input = typeof inputRef === 'string' ? document.querySelector(inputRef) : inputRef;
        if (!input) return null;

        const instId = ++globalInstId;
        const debounceMs = opciones.debounceMs || 450;
        const minChars = opciones.minChars || 3;
        const countrycodes = opciones.countrycodes || 'ar';
        const autoFill = opciones.autoFill !== false;

        // Asegurar que el contenedor tenga la clase .ubicacion-box
        let wrapper = input.closest('.ubicacion-box');
        if (!wrapper) {
            wrapper = input.parentElement;
            if (wrapper) wrapper.classList.add('ubicacion-box');
        }

        // Obtener o crear la lista de sugerencias
        let lista = null;
        if (opciones.lista) {
            lista = typeof opciones.lista === 'string' ? document.querySelector(opciones.lista) : opciones.lista;
        }
        if (!lista && wrapper) {
            lista = wrapper.querySelector('.ubicacion-sugerencias');
        }
        if (!lista && wrapper) {
            lista = document.createElement('ul');
            lista.className = 'ubicacion-sugerencias hidden';
            lista.id = `sug-lista-${instId}`;
            lista.setAttribute('role', 'listbox');
            lista.setAttribute('aria-label', 'Direcciones sugeridas');
            input.after(lista);
        }

        const listId = (lista && lista.id) ? lista.id : `sug-lista-${instId}`;
        if (lista && !lista.id) lista.id = listId;

        // Accesibilidad ARIA en el input
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', listId);

        let ubicacionTimer = null;
        let ubicacionAbort = null;
        let ubicacionSeq = 0;
        let sugItems = [];
        let sugActive = -1;

        function cerrarSugerencias() {
            if (lista) {
                lista.innerHTML = '';
                lista.classList.add('hidden');
            }
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            sugItems = [];
            sugActive = -1;
            if (typeof opciones.onClose === 'function') opciones.onClose();
        }

        function marcarActiva() {
            if (!lista) return;
            const items = lista.querySelectorAll('li[data-i]');
            items.forEach((li) => {
                const idx = Number(li.dataset.i);
                const on = idx === sugActive;
                li.classList.toggle('active', on);
                li.setAttribute('aria-selected', on ? 'true' : 'false');
                if (on) {
                    input.setAttribute('aria-activedescendant', li.id);
                    li.scrollIntoView({ block: 'nearest' });
                }
            });
            if (sugActive < 0) {
                input.removeAttribute('aria-activedescendant');
            }
        }

        function pintarSugerencias(items) {
            if (!lista) return;
            sugItems = items;
            sugActive = -1;
            if (!items || !items.length) {
                lista.innerHTML = '<li class="sug-estado">Sin resultados. Probá con calle y altura o barrio.</li>';
            } else {
                lista.innerHTML = items.map((it, i) => {
                    const t = etiquetaUbicacion(it);
                    return `<li role="option" id="sug-${instId}-${i}" data-i="${i}" aria-selected="false">
                        <span class="sug-titulo">${t.etiqueta}</span>
                        <span class="sug-detalle">${t.detalle}</span>
                    </li>`;
                }).join('');
            }
            lista.classList.remove('hidden');
            input.setAttribute('aria-expanded', 'true');
        }

        function elegir(item) {
            const t = etiquetaUbicacion(item);
            if (autoFill) {
                input.value = t.etiqueta;
            }
            cerrarSugerencias();
            if (typeof opciones.onSelect === 'function') {
                opciones.onSelect(item, {
                    etiqueta: t.etiqueta,
                    detalle: t.detalle,
                    lat: item.lat,
                    lon: item.lon,
                    raw: item,
                });
            }
        }

        async function buscarUbicacion(q) {
            const cacheKey = q.toLowerCase();
            if (ubicacionCache[cacheKey]) {
                pintarSugerencias(ubicacionCache[cacheKey]);
                return;
            }
            const mySeq = ++ubicacionSeq;
            const vigente = () => mySeq === ubicacionSeq;

            if (ubicacionAbort) {
                try { ubicacionAbort.abort(); } catch { /* noop */ }
            }
            ubicacionAbort = new AbortController();

            if (lista) {
                sugItems = [];
                sugActive = -1;
                lista.innerHTML = '<li class="sug-estado">Buscando ubicaciones…</li>';
                lista.classList.remove('hidden');
                input.setAttribute('aria-expanded', 'true');
            }

            const watchdog = setTimeout(() => {
                try { ubicacionAbort.abort(); } catch { /* noop */ }
            }, 8000);

            // 1) Nominatim (OpenStreetMap)
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=es&countrycodes=${encodeURIComponent(countrycodes)}&limit=6&q=${encodeURIComponent(q)}`;
                const res = await fetch(url, {
                    signal: ubicacionAbort.signal,
                    headers: { Accept: 'application/json' },
                });
                clearTimeout(watchdog);
                if (!vigente()) return;
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                const list = Array.isArray(data) ? data : [];
                ubicacionCache[cacheKey] = list;
                pintarSugerencias(list);
                return;
            } catch (err) {
                clearTimeout(watchdog);
                if (!vigente()) return;
            }

            // 2) Respaldo: Photon (Komoot, datos OSM)
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
                const list = (data.features || []).map(normalizarPhoton);
                ubicacionCache[cacheKey] = list;
                pintarSugerencias(list);
                return;
            } catch (err) {
                clearTimeout(watchdog2);
                if (!vigente()) return;
            }

            // 3) Error o sin conexión
            if (lista) {
                lista.innerHTML = '<li class="sug-estado">No se pudo buscar sugerencias. Escribí tu dirección manualmente.</li>';
            }
            if (typeof opciones.onError === 'function') {
                opciones.onError('No se pudieron buscar ubicaciones.');
            }
        }

        input.addEventListener('input', (e) => {
            if (typeof opciones.onInput === 'function') {
                opciones.onInput(e);
            }
            const q = input.value.trim();
            clearTimeout(ubicacionTimer);
            if (q.length < minChars) {
                cerrarSugerencias();
                return;
            }
            ubicacionTimer = setTimeout(() => buscarUbicacion(q), debounceMs);
        });

        input.addEventListener('keydown', (e) => {
            if (!lista || lista.classList.contains('hidden')) return;
            const opcionesDOM = lista.querySelectorAll('li[data-i]');
            if (!opcionesDOM.length) {
                if (e.key === 'Escape') cerrarSugerencias();
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                sugActive = (sugActive + 1) % opcionesDOM.length;
                marcarActiva();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                sugActive = (sugActive - 1 + opcionesDOM.length) % opcionesDOM.length;
                marcarActiva();
            } else if (e.key === 'Enter') {
                if (sugActive >= 0 && sugItems[sugActive]) {
                    e.preventDefault();
                    elegir(sugItems[sugActive]);
                }
            } else if (e.key === 'Escape') {
                cerrarSugerencias();
            }
        });

        if (lista) {
            lista.addEventListener('click', (e) => {
                const li = e.target.closest('li[data-i]');
                if (li && sugItems[Number(li.dataset.i)]) {
                    elegir(sugItems[Number(li.dataset.i)]);
                }
            });
        }

        const onDocClick = (e) => {
            if (wrapper && !wrapper.contains(e.target)) {
                cerrarSugerencias();
            }
        };
        document.addEventListener('click', onDocClick);

        return {
            cerrar: cerrarSugerencias,
            buscar: buscarUbicacion,
            getInput: () => input,
            getLista: () => lista,
            destruir: () => {
                document.removeEventListener('click', onDocClick);
                clearTimeout(ubicacionTimer);
            }
        };
    }

    // Exponer en el objeto global
    global.conectarAutocompletadoUbicacion = conectarAutocompletadoUbicacion;
    global.etiquetaUbicacion = etiquetaUbicacion;

})(typeof window !== 'undefined' ? window : this);
