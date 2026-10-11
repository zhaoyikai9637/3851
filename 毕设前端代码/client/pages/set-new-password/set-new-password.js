document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem('reset_token');
    if (!token) { window.location.replace('../forgot-password/forgot-password.html'); return; }
    const password = document.getElementById('newPassword'), confirm = document.getElementById('confirmPassword');
    const error = document.getElementById('newPasswordError'), button = document.getElementById('confirmBtn');
    document.getElementById('togglePassword').addEventListener('click', () => { password.type = password.type === 'password' ? 'text' : 'password'; });
    document.getElementById('resetPasswordForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (button.disabled) return;
        error.textContent = '';
        if (password.value !== confirm.value) { error.textContent = 'Passwords do not match.'; return; }
        if (!validatePasswordLength(password.value)) { error.textContent = 'Use at least 8 characters and at most 72 UTF-8 bytes.'; return; }
        button.disabled = true;
        try {
            await JRS.request('/set-new-password', { method: 'POST', body: { resetToken: token, newPassword: password.value } });
            sessionStorage.removeItem('reset_token'); sessionStorage.removeItem('reset_email');
            window.location.href = '../login/login.html';
        } catch (err) { error.textContent = err.message; }
        finally { button.disabled = false; }
    });
});
