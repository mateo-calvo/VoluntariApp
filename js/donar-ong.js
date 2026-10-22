// donar-ong.js — Módulo reutilizable de donaciones para ONGs con Mercado Pago
(() => {
  const MONTO_MINIMO = 1000;

  const formatearMonto = (n) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);

  function validarLinkMercadoPago(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const u = new URL(withProto);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      const host = u.hostname.toLowerCase();
      // Valida que el enlace pertenezca a Mercado Pago
      if (
        host.includes('mercadopago') ||
        host.includes('mpago.la') ||
        host.includes('mpago.li')
      ) {
        return u.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  function asegurarModalEnDOM() {
    let modal = document.getElementById('donar-modal-ong');
    if (modal) return modal;

    modal = document.createElement('dialog');
    modal.className = 'donar-modal';
    modal.id = 'donar-modal-ong';
    modal.setAttribute('aria-labelledby', 'donar-title-ong');

    modal.innerHTML = `
      <form class="donar-form" id="donar-form-ong" novalidate>
        <button type="button" class="donar-close" data-donar-close-ong aria-label="Cerrar">×</button>

        <div class="donar-body" id="donar-body-ong">
          <div class="donar-mp-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span>Mercado Pago</span>
          </div>

          <h2 class="donar-title" id="donar-title-ong">Apoyá a esta ONG</h2>
          <p class="donar-description" id="donar-description-ong">
            Tu donación ayuda a que la organización continúe con su labor comunitaria. Elegí cómo querés colaborar.
          </p>

          <div class="donar-toggle" role="group" aria-label="Tipo de donación">
            <button type="button" class="donar-toggle-btn is-active" data-tipo="unica" aria-pressed="true">Una vez</button>
            <button type="button" class="donar-toggle-btn" data-tipo="mensual" aria-pressed="false">Todos los meses</button>
          </div>

          <div class="donar-amounts" role="group" aria-label="Monto">
            <button type="button" class="donar-amount" data-monto="2000">$2.000</button>
            <button type="button" class="donar-amount is-active" data-monto="5000">$5.000</button>
            <button type="button" class="donar-amount" data-monto="10000">$10.000</button>
            <button type="button" class="donar-amount" data-monto="20000">$20.000</button>
          </div>

          <label class="donar-custom" for="donar-custom-input-ong">
            <span>Otro monto</span>
            <div class="donar-custom-field">
              <span class="donar-custom-prefix">$</span>
              <input type="number" id="donar-custom-input-ong" inputmode="numeric" min="1000" step="100" placeholder="Mínimo $1.000">
            </div>
          </label>

          <p class="donar-hint" id="donar-hint-ong">Se cobra una sola vez.</p>
          <p class="donar-error" id="donar-error-ong" role="alert" hidden></p>

          <button type="submit" class="btn btn-register donar-submit" id="donar-submit-ong">Donar $5.000</button>
        </div>

        <div class="donar-success" id="donar-success-ong" hidden>
          <div class="donar-mp-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span>Mercado Pago</span>
          </div>
          <h2 class="donar-title" id="donar-success-title-ong">Completá tu donación</h2>
          <p class="donar-description" id="donar-success-text-ong"></p>
          <a href="#" class="btn btn-register donar-submit" id="donar-mp-link-ong" target="_blank" rel="noopener noreferrer">Ir a Mercado Pago</a>
          <button type="button" class="btn btn-login donar-submit" data-donar-close-ong>Cerrar</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  // Estado interno de la sesión de donación actual
  let estadoModal = {
    nombreONG: 'la organización',
    mpLink: '',
    tipo: 'unica',
    monto: 5000,
  };

  function inicializarEventosModal(modal) {
    if (modal.dataset.initDone) return;
    modal.dataset.initDone = 'true';

    const form = modal.querySelector('#donar-form-ong');
    const customInput = modal.querySelector('#donar-custom-input-ong');
    const toggleBtns = modal.querySelectorAll('.donar-toggle-btn');
    const amountBtns = modal.querySelectorAll('.donar-amount');

    const cerrar = () => {
      if (modal.open) modal.close();
      document.body.style.overflow = '';
    };

    modal.querySelectorAll('[data-donar-close-ong]').forEach((btn) => {
      btn.addEventListener('click', cerrar);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrar();
    });

    modal.addEventListener('close', () => {
      document.body.style.overflow = '';
    });

    const actualizarVista = () => {
      const hint = modal.querySelector('#donar-hint-ong');
      const submitBtn = modal.querySelector('#donar-submit-ong');
      const esMensual = estadoModal.tipo === 'mensual';

      if (hint) {
        hint.textContent = esMensual
          ? 'Se renueva cada mes. Podés cancelarla cuando quieras desde Mercado Pago.'
          : 'Se cobra una sola vez.';
      }

      if (submitBtn) {
        submitBtn.textContent =
          estadoModal.monto > 0
            ? `Donar ${formatearMonto(estadoModal.monto)}${esMensual ? ' por mes' : ''}`
            : 'Donar';
      }
    };

    const seleccionarTipo = (tipo) => {
      estadoModal.tipo = tipo;
      toggleBtns.forEach((b) => {
        const activo = b.dataset.tipo === tipo;
        b.classList.toggle('is-active', activo);
        b.setAttribute('aria-pressed', String(activo));
      });
      actualizarVista();
    };

    const seleccionarMonto = (monto, desdeInput = false) => {
      estadoModal.monto = monto;
      const error = modal.querySelector('#donar-error-ong');
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }

      amountBtns.forEach((b) => {
        const activo = !desdeInput && Number(b.dataset.monto) === monto;
        b.classList.toggle('is-active', activo);
      });

      if (!desdeInput && customInput) {
        customInput.value = '';
      }
      actualizarVista();
    };

    toggleBtns.forEach((b) => {
      b.addEventListener('click', () => seleccionarTipo(b.dataset.tipo));
    });

    amountBtns.forEach((b) => {
      b.addEventListener('click', () => seleccionarMonto(Number(b.dataset.monto)));
    });

    customInput?.addEventListener('input', () => {
      const val = Number(customInput.value);
      if (!customInput.value) {
        seleccionarMonto(5000);
        return;
      }
      seleccionarMonto(val > 0 ? val : 0, true);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const error = modal.querySelector('#donar-error-ong');
      const body = modal.querySelector('#donar-body-ong');
      const success = modal.querySelector('#donar-success-ong');
      const successText = modal.querySelector('#donar-success-text-ong');
      const mpLinkBtn = modal.querySelector('#donar-mp-link-ong');

      if (!estadoModal.monto || estadoModal.monto < MONTO_MINIMO) {
        if (error) {
          error.textContent = `El monto mínimo de donación es ${formatearMonto(MONTO_MINIMO)}.`;
          error.hidden = false;
        }
        customInput?.focus();
        return;
      }

      if (error) error.hidden = true;

      const link = estadoModal.mpLink;
      if (!link) {
        if (error) {
          error.textContent = 'Esta ONG no posee un enlace de Mercado Pago activo en este momento.';
          error.hidden = false;
        }
        return;
      }

      const montoTexto = formatearMonto(estadoModal.monto);
      const esMensual = estadoModal.tipo === 'mensual';

      if (successText) {
        successText.textContent = esMensual
          ? `Te llevamos a Mercado Pago para que configures tu aporte mensual de ${montoTexto} para ${estadoModal.nombreONG}. Podés cancelarlo cuando quieras.`
          : `Te llevamos a Mercado Pago para que completes tu donación de ${montoTexto} a ${estadoModal.nombreONG}.`;
      }

      if (mpLinkBtn) {
        mpLinkBtn.href = link;
      }

      // Abre el link de Mercado Pago de la ONG en una pestaña nueva
      try {
        window.open(link, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Bloqueador de ventanas emergentes activado:', err);
      }

      body.hidden = true;
      success.hidden = false;
    });

    // Guardar referencia para resetear al abrir
    modal._reset = () => {
      const body = modal.querySelector('#donar-body-ong');
      const success = modal.querySelector('#donar-success-ong');
      const error = modal.querySelector('#donar-error-ong');
      if (body) body.hidden = false;
      if (success) success.hidden = true;
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
      if (customInput) customInput.value = '';
      seleccionarTipo('unica');
      seleccionarMonto(5000);
    };
  }

  function abrirModalDonacionONG({ nombre, mpLink }) {
    const linkValido = validarLinkMercadoPago(mpLink);
    if (!linkValido) {
      console.warn('DonarONG: La ONG no posee un link de Mercado Pago válido:', mpLink);
      return;
    }

    const modal = asegurarModalEnDOM();
    inicializarEventosModal(modal);

    const nombreLimpio = nombre ? String(nombre).trim() : 'la organización';
    estadoModal.nombreONG = nombreLimpio;
    estadoModal.mpLink = linkValido;

    const titleEl = modal.querySelector('#donar-title-ong');
    if (titleEl) titleEl.textContent = `Apoyá a ${nombreLimpio}`;

    const descEl = modal.querySelector('#donar-description-ong');
    if (descEl) {
      descEl.textContent = `Tu donación ayuda a que ${nombreLimpio} continúe con sus actividades y proyectos comunitarios. Elegí cómo querés colaborar.`;
    }

    modal._reset();
    modal.showModal();
    document.body.style.overflow = 'hidden';
  }

  // API global
  window.DonarONG = {
    abrir: abrirModalDonacionONG,
    validarLink: validarLinkMercadoPago,
    esMercadoPago: (url) => !!validarLinkMercadoPago(url),
  };
})();
