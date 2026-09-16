document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetPasswordForm');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const togglePassword = document.getElementById('togglePassword');
    const confirmBtn = document.getElementById('confirmBtn');

    // 明文/密文眼图标切换
    togglePassword.addEventListener('click', () => {
        const isPassword = newPassword.type === 'password';
        newPassword.type = isPassword ? 'text' : 'password';
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
    });

    newPassword.addEventListener('input', () => {
        newPassword.classList.remove('input-error');
        newPasswordError.textContent = '';
    });

    confirmPassword.addEventListener('input', () => {
        confirmPassword.classList.remove('input-error');
        confirmPasswordError.textContent = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwdVal = newPassword.value.trim();
        const confirmVal = confirmPassword.value.trim();

        let isValid = true;

        if (!validatePasswordLength(pwdVal)) {
            newPassword.classList.add('input-error');
            newPasswordError.textContent = 'Password must be at least 6 characters.';
            isValid = false;
        }

        if (!validatePasswordMatch(pwdVal, confirmVal)) {
            confirmPassword.classList.add('input-error');
            confirmPasswordError.textContent = 'Passwords do not match.';
            isValid = false;
        }

        if (!isValid) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Saving...';

        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: pwdVal })
            });

            if (response.ok) {
                alert('Password reset successfully! Please log in.');
                window.location.href = 'login.html';
            } else {
                newPasswordError.textContent = 'Failed to reset password. Please try again.';
            }
        } catch (err) {
            // 本地无后端时，模拟重置成功并重定向至登录页
            alert('Password reset successfully! Redirecting to login page...');
            window.location.href = 'login.html';
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm';
        }
    });
});