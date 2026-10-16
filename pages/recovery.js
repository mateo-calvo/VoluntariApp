document.addEventListener('DOMContentLoaded', () => {
    const recoveryForm = document.getElementById('recovery-form');
    const emailInput = document.getElementById('email');

    if (recoveryForm) {
        recoveryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailValue = emailInput.value.trim();

            if (emailValue === '') {
                alert('Por favor, ingresa un correo electrónico válido.');
                return;
            }

            alert(`Si el correo ${emailValue} está registrado en VoluntariApp, te enviaremos un enlace para restablecer tu contraseña.`);
            recoveryForm.reset();
        });
    }
});