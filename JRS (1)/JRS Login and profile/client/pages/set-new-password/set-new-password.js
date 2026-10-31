document.addEventListener('DOMContentLoaded', () => {
    const incoming = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if(window.location.hash) {
        history.replaceState(null,'',window.location.pathname+window.location.search);
        sessionStorage.removeItem('reset_token');
        if(/^[a-f0-9]{64}$/.test(incoming || '')) sessionStorage.setItem('reset_token',incoming);
    }
    const token = sessionStorage.getItem('reset_token');
    if (!token) { window.location.replace('../forgot-password/forgot-password.html'); return; }
    const password = document.getElementById('newPassword'), confirm = document.getElementById('confirmPassword');
    const error = document.getElementById('newPasswordError'), button = document.getElementById('confirmBtn');
    function setPasswordVisible(visible) {
        password.type = visible ? 'text' : 'password';
        const toggle = document.getElementById('togglePassword');
        toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
        toggle.setAttribute('aria-pressed', String(visible));
        document.getElementById('passwordSlash').toggleAttribute('hidden', visible);
    }
    document.getElementById('togglePassword').addEventListener('click', () => setPasswordVisible(password.type === 'password'));
    setPasswordVisible(false);
    window.addEventListener('pageshow', () => { setPasswordVisible(false); confirm.type = 'password'; });
    document.getElementById('resetPasswordForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (button.disabled) return;
        error.textContent = '';
        if (password.value !== confirm.value) { error.textContent = 'Passwords do not match.'; return; }
        const policyError = JRSPasswordPolicy.passwordPolicyError(password.value);
        if (policyError) { error.textContent = policyError; password.focus(); return; }
        button.disabled = true;
        try {
            await JRS.request('/set-new-password', { method: 'POST', body: { resetToken: token, newPassword: password.value } });
            sessionStorage.removeItem('reset_token'); sessionStorage.removeItem('reset_email');
            window.location.href = '../login/login.html';
        } catch (err) { error.textContent = err.message; }
        finally { button.disabled = false; }
    });
});
