// MODAL DE DONACIÓN
(() => {
    const MONTO_MINIMO = 1000;

    // LINKS DE MERCADO PAGO
    // Pegá acá los links que generás desde tu cuenta de Mercado Pago:
    //  - unica:   "Link de pago" (uno por cada monto sugerido)
    //  - mensual: "Plan de suscripción" (uno por cada monto sugerido)
    // La clave "otro" se usa cuando la persona escribe un monto distinto
    // (por ejemplo, un plan de suscripción con monto abierto). Si queda
    // vacía, ese tipo de donación solo permite los montos sugeridos.
    const MP_LINKS = {
        unica: {
            2000: '',
            5000: '',
            10000: '',
            20000: '',
            otro: '',
        },
        mensual: {
            2000: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=XXXX',
            5000: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=XXXX',
            10000: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=XXXX',
            20000: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=XXXX',
            otro: '',
        },
    };

    const obtenerLink = (tipo, monto) => MP_LINKS[tipo][monto] || MP_LINKS[tipo].otro || '';

    const modal = document.getElementById('donar-modal');
    const form = document.getElementById('donar-form');
    const openBtn = document.getElementById('donar-open');
    const body = document.getElementById('donar-body');
    const success = document.getElementById('donar-success');
    const successText = document.getElementById('donar-success-text');
    const mpLink = document.getElementById('donar-mp-link');
    const customInput = document.getElementById('donar-custom-input');
    const hint = document.getElementById('donar-hint');
    const error = document.getElementById('donar-error');
    const submitBtn = document.getElementById('donar-submit');
    const toggleBtns = document.querySelectorAll('.donar-toggle-btn');
    const amountBtns = document.querySelectorAll('.donar-amount');

    if (!modal || !form || !openBtn) return;

    const formatearMonto = (n) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
        }).format(n);

    // Estado actual de la donación
    const estado = {
        tipo: 'unica', // 'unica' | 'mensual'
        monto: 5000,
    };

    const esMensual = () => estado.tipo === 'mensual';

    function mostrarError(mensaje) {
        error.textContent = mensaje;
        error.hidden = false;
    }

    function limpiarError() {
        error.textContent = '';
        error.hidden = true;
    }

    // Actualiza textos según tipo y monto
    function actualizarTextos() {
        hint.textContent = esMensual()
            ? 'Se renueva cada mes. Podés cancelarla cuando quieras.'
            : 'Se cobra una sola vez.';

        submitBtn.textContent =
            estado.monto > 0
                ? `Donar ${formatearMonto(estado.monto)}${esMensual() ? ' por mes' : ''}`
                : 'Donar';
    }

    function seleccionarTipo(tipo) {
        estado.tipo = tipo;
        toggleBtns.forEach((btn) => {
            const activo = btn.dataset.tipo === tipo;
            btn.classList.toggle('is-active', activo);
            btn.setAttribute('aria-pressed', String(activo));
        });
        actualizarTextos();
    }

    function seleccionarMonto(monto, desdeInput = false) {
        estado.monto = monto;
        limpiarError();

        amountBtns.forEach((btn) => {
            const activo = !desdeInput && Number(btn.dataset.monto) === monto;
            btn.classList.toggle('is-active', activo);
        });

        if (!desdeInput) customInput.value = '';
        actualizarTextos();
    }

    function reiniciar() {
        body.hidden = false;
        success.hidden = true;
        customInput.value = '';
        limpiarError();
        seleccionarTipo('unica');
        seleccionarMonto(5000);
    }

    function abrir() {
        reiniciar();
        modal.showModal();
        document.body.style.overflow = 'hidden';
    }

    function cerrar() {
        modal.close();
    }

    // Abrir / cerrar
    openBtn.addEventListener('click', abrir);

    modal.querySelectorAll('[data-donar-close]').forEach((btn) => {
        btn.addEventListener('click', cerrar);
    });

    // Click en el fondo oscuro (fuera del contenido) cierra el modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrar();
    });

    // Se dispara con el botón, el fondo o la tecla Esc
    modal.addEventListener('close', () => {
        document.body.style.overflow = '';
        openBtn.focus();
    });

    // Tipo de donación
    toggleBtns.forEach((btn) => {
        btn.addEventListener('click', () => seleccionarTipo(btn.dataset.tipo));
    });

    // Montos sugeridos
    amountBtns.forEach((btn) => {
        btn.addEventListener('click', () => seleccionarMonto(Number(btn.dataset.monto)));
    });

    // Monto personalizado
    customInput.addEventListener('input', () => {
        const valor = Number(customInput.value);

        if (!customInput.value) {
            // Si lo vacía, vuelve al monto sugerido por defecto
            seleccionarMonto(5000);
            return;
        }

        seleccionarMonto(valor > 0 ? valor : 0, true);
    });

    // Enviar
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!estado.monto || estado.monto < MONTO_MINIMO) {
            mostrarError(`El monto mínimo es ${formatearMonto(MONTO_MINIMO)}.`);
            customInput.focus();
            return;
        }

        const link = obtenerLink(estado.tipo, estado.monto);

        if (!link) {
            const esMontoSugerido = estado.monto in MP_LINKS[estado.tipo];

            mostrarError(
                esMontoSugerido
                    ? 'Este monto todavía no tiene un link de Mercado Pago configurado.'
                    : 'Para este monto elegí uno de los sugeridos. Estamos sumando más opciones.'
            );
            return;
        }

        limpiarError();

        const montoTexto = formatearMonto(estado.monto);

        successText.textContent = esMensual()
            ? `Te llevamos a Mercado Pago para que actives tu aporte de ${montoTexto} por mes. Podés cancelarlo cuando quieras.`
            : `Te llevamos a Mercado Pago para que completes tu donación de ${montoTexto}.`;

        mpLink.href = link;

        // Abrimos Mercado Pago en otra pestaña. Si el navegador la bloquea,
        // queda el botón "Ir a Mercado Pago" para continuar.
        window.open(link, '_blank', 'noopener,noreferrer');

        body.hidden = true;
        success.hidden = false;
    });

    // Estado inicial
    reiniciar();
})();
