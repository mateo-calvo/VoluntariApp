// login.js - Inicio de sesión de VoluntariApp
// Usa la API (server/) si está disponible; si no, modo demo local.
// Guarda la sesión en sessionStorage y respeta ?next= para volver al mapa.

document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('toggle-password');
    const eyeOpen = document.querySelector('.eye-open');
    const eyeClosed = document.querySelector('.eye-closed');
    const loginForm = document.getElementById('login-form');
    const errorBox = document.getElementById('login-error');

    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conv');

    // ?next= solo se acepta si es EXACTAMENTE una de estas páginas propias.
    // Cualquier otra cosa (https://..., javascript:..., //otro-sitio) se ignora:
    // evita redirigir a sitios externos o ejecutar código desde la URL.
    const NEXT_PERMITIDOS = ['mapa.html', 'admin.html', 'mi-ong.html', 'mis-convocatorias.html', 'participaciones.html'];
    const nextParam = params.get('next');
    const next = NEXT_PERMITIDOS.includes(nextParam) ? nextParam : null;

    // Sin next válido, el destino depende del rol de la sesión.
    const DESTINO_POR_ROL = {
        admin: 'admin.html',
        ong: 'mi-ong.html',
        voluntario: 'mapa.html',
    };

    // Cuentas de prueba con credenciales reales en Supabase
    const DEMO_ACCOUNTS = {
        'btn-demo-voluntario': { nombre: 'Ana Lubari', email: 'analubari@gmail.com', password: 'Voluntario123!', rol: 'voluntario' },
        'btn-demo-ong': { nombre: 'Cruz Roja Argentina', email: 'contacto@cruzroja.org.ar', password: 'Ong1234!', rol: 'ong' },
        'btn-demo-admin': { nombre: 'Administrador General', email: 'admin@voluntariapp.org', password: 'Admin1234!', rol: 'admin' },
    };
    const DEMO_CREDS = {
        'btn-demo-voluntario': { email: 'analubari@gmail.com', password: 'Voluntario123!' },
        'btn-demo-ong': { email: 'contacto@cruzroja.org.ar', password: 'Ong1234!' },
        'btn-demo-admin': { email: 'admin@voluntariapp.org', password: 'Admin1234!' },
    };
    const DEMO_ROLES = { 'analubari@gmail.com': 'voluntario', 'contacto@cruzroja.org.ar': 'ong', 'admin@voluntariapp.org': 'admin' };

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
    }

    if (params.get('expired') === '1') {
        showError('Tu sesión ha expirado. Por favor, iniciá sesión nuevamente.');
    }

    function redirectAfterLogin(session) {
        const destino = next || DESTINO_POR_ROL[session?.rol] || 'mapa.html';
        if (convId) {
            window.location.href = `${destino}?conv=${encodeURIComponent(convId)}`;
        } else {
            window.location.href = destino;
        }
    }

    // Intento de login demo local. Solo coincide si la cuenta existe con clave correcta.
    function demoLogin(email, password) {
        const cuentaFija = Object.values(DEMO_ACCOUNTS).find(
            (u) => u.email === email && u.password === password
        );
        if (cuentaFija) return cuentaFija;

        const demoUsers = JSON.parse(localStorage.getItem('va_users_demo') || '[]');
        const found = demoUsers.find((u) => u.email === email && u.password === password);
        if (found) {
            return {
                nombre: found.nombre || email.split('@')[0],
                email: found.email,
                rol: found.rol || 'voluntario',
            };
        }
        return null;
    }

    function entrarConSesion(session) {
        sessionStorage.setItem('va_session', JSON.stringify(session));
        redirectAfterLogin(session);
    }

    // Toggle de visibilidad de la contraseña
    if (toggleButton && passwordInput) {
        toggleButton.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';

            if (eyeOpen && eyeClosed) {
                eyeOpen.style.display = isPassword ? 'none' : 'block';
                eyeClosed.style.display = isPassword ? 'block' : 'none';
            }

            toggleButton.setAttribute(
                'aria-label',
                isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            );
        });
    }

    // Envío del formulario
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorBox?.classList.add('hidden');

            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = passwordInput.value;

            const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email || !password) {
                showError('Por favor, completa todos los campos requeridos.');
                return;
            }
            if (!EMAIL_RE.test(email)) {
                showError('Por favor, ingresa un correo electrónico válido.');
                return;
            }

            const submitBtn = loginForm.querySelector('.btn-submit');
            const originalContent = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Ingresando...</span>';

            try {
                // Intento contra la API real
                const res = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    signal: AbortSignal.timeout(8000),
                });

                const data = await res.json().catch(() => ({}));

                if (res.ok && data.token) {
                    sessionStorage.setItem('va_token', data.token);
                    sessionStorage.setItem('va_session', JSON.stringify(data.user));
                    redirectAfterLogin(data.user);
                    return;
                }

                if (res.status === 401) {
                    showError(data.message || 'Credenciales incorrectas. Revisa tu email y contraseña.');
                    return;
                }

                showError(data.message || 'No se pudo iniciar sesión. Intenta nuevamente.');
            } catch (err) {
                // Si el servidor backend no responde (offline), solo permite las cuentas demo conocidas
                const demo = demoLogin(email, password);
                if (demo) {
                    entrarConSesion(demo);
                    return;
                }
                showError('No se pudo conectar con el servidor. Revisa tu conexión.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        });
    }

    // Actualiza el texto del encabezado y placeholder según el rol seleccionado
    const authSubtitle = document.getElementById('auth-subtitle');
    const emailInput = document.getElementById('email');

    function actualizarEncabezadoPorRol(btnId) {
        if (btnId === 'btn-demo-ong') {
            if (authSubtitle) authSubtitle.textContent = 'Inicia sesión para crear convocatorias y gestionar tu ONG.';
            if (emailInput) emailInput.placeholder = 'contacto@tuong.org';
        } else if (btnId === 'btn-demo-admin') {
            if (authSubtitle) authSubtitle.textContent = 'Inicia sesión para acceder al panel de administración.';
            if (emailInput) emailInput.placeholder = 'admin@voluntariapp.org';
        } else {
            if (authSubtitle) authSubtitle.textContent = 'Inicia sesión para participar en convocatorias de voluntariado.';
            if (emailInput) emailInput.placeholder = 'tu@correo.com';
        }
    }

    // Botones de selección de rol: actualizan el encabezado sin autocompletar credenciales
    for (const btnId of ['btn-demo-voluntario', 'btn-demo-ong', 'btn-demo-admin']) {
        document.getElementById(btnId)?.addEventListener('click', () => {
            errorBox?.classList.add('hidden');
            actualizarEncabezadoPorRol(btnId);
            emailInput?.focus();
        });
    }
});
