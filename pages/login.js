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
    const NEXT_PERMITIDOS = ['mapa.html', 'admin.html', 'mi-ong.html', 'participaciones.html'];
    const nextParam = params.get('next');
    const next = NEXT_PERMITIDOS.includes(nextParam) ? nextParam : null;

    // Sin next válido, el destino depende del rol de la sesión.
    const DESTINO_POR_ROL = {
        admin: 'admin.html',
        ong: 'mi-ong.html',
        voluntario: 'mapa.html',
    };

    // Cuentas demo del seed (solo para mostrar)
    const DEMO_ACCOUNTS = {
        'btn-demo-voluntario': { nombre: 'Demo Voluntario', email: 'demo@voluntariapp.org', password: 'demo1234', rol: 'voluntario' },
        'btn-demo-ong': { nombre: 'ONG de Prueba', email: 'ong@test.com', password: 'demo1234', rol: 'ong' },
        'btn-demo-admin': { nombre: 'Admin Demo', email: 'admin@test.com', password: 'demo1234', rol: 'admin' },
    };
    const DEMO_CREDS = {
        'btn-demo-voluntario': { email: 'demo@voluntariapp.org', password: 'demo1234' },
        'btn-demo-ong': { email: 'ong@test.com', password: 'demo1234' },
        'btn-demo-admin': { email: 'admin@test.com', password: 'demo1234' },
    };
    const DEMO_ROLES = { 'demo@voluntariapp.org': 'voluntario', 'ong@test.com': 'ong', 'admin@test.com': 'admin' };

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
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

            if (!email || !password) {
                showError('Por favor, completa todos los campos requeridos.');
                return;
            }
            if (password.length < 6) {
                showError('La contraseña debe tener al menos 6 caracteres.');
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

    // Botones de acceso demo: restablecen la cuenta demo local (por si el
    // email se registró antes con otra clave) y envían el formulario
    for (const [btnId, creds] of Object.entries(DEMO_CREDS)) {
        document.getElementById(btnId)?.addEventListener('click', () => {
            errorBox?.classList.add('hidden');
            try {
                const users = JSON.parse(localStorage.getItem('va_users_demo') || '[]');
                const acc = DEMO_ACCOUNTS[btnId];
                const i = users.findIndex((u) => u.email === acc.email);
                if (i >= 0) users[i] = acc;
                else users.push(acc);
                localStorage.setItem('va_users_demo', JSON.stringify(users));
            } catch { /* sigue igual con el envío */ }
            document.getElementById('email').value = creds.email;
            passwordInput.value = creds.password;
            loginForm.requestSubmit();
        });
    }
});
