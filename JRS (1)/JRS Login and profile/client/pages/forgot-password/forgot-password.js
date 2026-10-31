document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotPasswordForm'), button = document.getElementById('sendBtn');
    const error = document.getElementById('emailError');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (button.disabled) return;
        error.textContent = ''; button.disabled = true;
        const email = document.getElementById('email').value.trim();
        try {
            const result = await JRS.request('/forgot-password', { method: 'POST', body: { email } });
            sessionStorage.setItem('reset_email', email);
            sessionStorage.setItem('reset_mode',result.recoveryMode || 'code');
            sessionStorage.removeItem('reset_token');
            localStorage.removeItem('reset_email');
            window.location.href = '../check-email/check-email.html';
        } catch (err) { error.textContent = err.message; }
        finally { button.disabled = false; }
    });
});
