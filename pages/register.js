// register.js

// Referencias a los elementos del toggle
const btnVoluntario = document.getElementById('btn-voluntario');
const btnOng = document.getElementById('btn-ong');

// Referencias a los grupos de campos
const camposVoluntario = document.getElementById('campos-voluntario');
const camposOng = document.getElementById('campos-ong');

// Referencia al botón de enviar
const botonEnviar = document.getElementById('boton-enviar');

// Función para activar el modo "voluntario"
function activarVoluntario() {
    btnVoluntario.classList.add('active');
    btnOng.classList.remove('active');

    camposVoluntario.hidden = false;
    camposOng.hidden = true;

    botonEnviar.innerHTML = 'Crear cuenta gratis <span aria-hidden="true">→</span>';
}

// Función para activar el modo "ONG"
function activarOng() {
    btnOng.classList.add('active');
    btnVoluntario.classList.remove('active');

    camposOng.hidden = false;
    camposVoluntario.hidden = true;

    botonEnviar.innerHTML = 'Enviar solicitud de registro <span aria-hidden="true">→</span>';
}

// Escuchar los clics en cada botón
btnVoluntario.addEventListener('click', activarVoluntario);
btnOng.addEventListener('click', activarOng);


// ---------- Ojito de mostrar/ocultar contraseña ----------
const botonOjito = document.querySelector('.toggle-password');
const inputPassword = document.getElementById('password');

botonOjito.addEventListener('click', function () {
    const esPassword = inputPassword.type === 'password';
    inputPassword.type = esPassword ? 'text' : 'password';
    botonOjito.textContent = esPassword ? '🙈' : '👁';
});