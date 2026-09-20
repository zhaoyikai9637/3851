document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotPasswordForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const sendBtn = document.getElementById('sendBtn');

    if (emailInput) {
        emailInput.addEventListener('input', () => {
            emailInput.classList.remove('input-error');
            if (emailError) emailError.textContent = '';
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput ? emailInput.value.trim() : '';

            if (!email) {
                showFieldError('Email address is required.');
                return;
            }

            // 如果 forgot_utils.js 中定义了 isValidEmail，进行二次格式校验
            if (typeof isValidEmail === 'function' && !isValidEmail(email)) {
                showFieldError('Please enter a valid email address.');
                return;
            }

            setLoadingState(true);

            try {
                // 对接后端 Node.js API 接口
                const response = await fetch('http://127.0.0.1:3001/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok && data.valid) {
                    // 保存邮箱至 localStorage，供下一页 (check-email) 渲染与验证使用
                    localStorage.setItem('reset_email', email);
                    window.location.href = "../check-email/check-email.html";
                } else {
                    showFieldError(data.error || data.message || 'Email address not found.');
                }
            } catch (error) {
                showFieldError('Cannot connect to server. Please check if backend is running.');
            } finally {
                setLoadingState(false);
            }
        });
    }

    function showFieldError(msg) {
        if (emailInput) emailInput.classList.add('input-error');
        if (emailError) emailError.textContent = msg;
    }

    function setLoadingState(isLoading) {
        if (!sendBtn) return;
        if (isLoading) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
        } else {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send reset link';
        }
    }
});