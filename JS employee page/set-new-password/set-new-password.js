document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetPasswordForm');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const togglePassword = document.getElementById('togglePassword');
    const confirmBtn = document.getElementById('confirmBtn');

    // 1. 明文/密文眼图标切换
    if (togglePassword && newPassword) {
        togglePassword.addEventListener('click', () => {
            const isPassword = newPassword.type === 'password';
            newPassword.type = isPassword ? 'text' : 'password';
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }

    // 2. 清除输入框错误提示
    if (newPassword) {
        newPassword.addEventListener('input', () => {
            newPassword.classList.remove('input-error');
            if (newPasswordError) newPasswordError.textContent = '';
        });
    }

    if (confirmPassword) {
        confirmPassword.addEventListener('input', () => {
            confirmPassword.classList.remove('input-error');
            if (confirmPasswordError) confirmPasswordError.textContent = '';
        });
    }

    // 3. 表单提交重置密码
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pwdVal = newPassword ? newPassword.value.trim() : '';
            const confirmVal = confirmPassword ? confirmPassword.value.trim() : '';

            // 获取前两个页面保存的邮箱
            const email = localStorage.getItem('reset_email');

            let isValid = true;

            // 调用 set_password_utils.js 中的 validatePasswordLength 或默认校验
            const isLengthValid = typeof validatePasswordLength === 'function' 
                ? validatePasswordLength(pwdVal) 
                : pwdVal.length >= 6;

            if (!isLengthValid) {
                if (newPassword) newPassword.classList.add('input-error');
                if (newPasswordError) newPasswordError.textContent = 'Password must be at least 6 characters.';
                isValid = false;
            }

            // 调用 set_password_utils.js 中的 validatePasswordMatch 或默认校验
            const isMatchValid = typeof validatePasswordMatch === 'function' 
                ? validatePasswordMatch(pwdVal, confirmVal) 
                : (pwdVal === confirmVal && confirmVal !== '');

            if (!isMatchValid) {
                if (confirmPassword) confirmPassword.classList.add('input-error');
                if (confirmPasswordError) confirmPasswordError.textContent = 'Passwords do not match.';
                isValid = false;
            }

            if (!isValid) return;

            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Saving...';
            }

            try {
                // 发送后端请求更新 Aiven 数据库中的密码
                const response = await fetch('http://127.0.0.1:3001/api/set-new-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, newPassword: pwdVal })
                });

                const data = await response.json();

                if (response.ok && data.valid) {
                    // 清理本地存储的临时邮箱
                    localStorage.removeItem('reset_email');
                    alert('Password reset successfully! Redirecting to login page...');
                    // 跳转回 Login Page 目录下的 Login.html
                    window.location.href = '../Login Page/Login.html';
                } else {
                    if (newPasswordError) {
                        newPasswordError.textContent = data.error || data.message || 'Failed to reset password. Please try again.';
                    }
                }
            } catch (err) {
                if (newPasswordError) {
                    newPasswordError.textContent = 'Cannot connect to server. Please check if backend is running.';
                }
            } finally {
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Confirm';
                }
            }
        });
    }
});