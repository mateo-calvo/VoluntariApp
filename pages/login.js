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
    const next = params.get('next') || 'mapa.html';
    const convId = params.get('conv');

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

    function redirectAfterLogin() {
        if (convId) {
            window.location.href = `${next}?conv=${encodeURIComponent(convId)}`;
        } else {
            window.location.href = next;
        }
    }

    // Intento de login demo local. Devuelve la sesión, null si la clave no
    // coincide con una cuenta demo conocida, o 'nueva' si hay que crearla.
    function demoLogin(email, password) {
        const demoUsers = JSON.parse(localStorage.getItem('va_users_demo') || '[]');
        const found = demoUsers.find((u) => u.email === email);
        if (found && found.password !== password) return null;
        return {
            nombre: found?.nombre || (email === 'ong@test.com' ? 'ONG de Prueba' : email.split('@')[0]),
            email,
            rol: found?.rol || DEMO_ROLES[email] || 'voluntario',
        };
    }

    function entrarConSesion(session) {
        sessionStorage.setItem('va_session', JSON.stringify(session));
        redirectAfterLogin();
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
                // Intento contra la API real (con timeout: en hosting estático
                // o pendrive falla rápido y se usa el modo demo local)
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    signal: AbortSignal.timeout(5000),
                });
                const data = await res.json().catch(() => ({}));

                if (res.ok && data.token) {
                    sessionStorage.setItem('va_token', data.token);
                    sessionStorage.setItem('va_session', JSON.stringify(data.user));
                    redirectAfterLogin();
                    return;
                }
                if (res.status === 401) {
                    // La API no conoce esta cuenta: puede existir solo en modo
                    // demo local (navegador). Se prueba ahí antes de fallar.
                    const demo = demoLogin(email, password);
                    if (demo) {
                        entrarConSesion(demo);
                        return;
                    }
                    showError('Credenciales incorrectas. Revisa tu email y contraseña.');
                    return;
                }
                throw new Error(data.message || 'Respuesta inválida del servidor');
                } catch (err) {
                // Modo demo (sin backend): cualquier cuenta válida entra
                try {
                    const demo = demoLogin(email, password);
                    if (!demo) {
                        showError('Credenciales incorrectas. Revisa tu email y contraseña.');
                        return;
                    }
                    entrarConSesion(demo);
                } catch {
                    showError('No se pudo iniciar sesión. Intenta de nuevo.');
                }
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
