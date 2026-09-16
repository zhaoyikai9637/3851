document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotPasswordForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const sendBtn = document.getElementById('sendBtn');

    emailInput.addEventListener('input', () => {
        emailInput.classList.remove('input-error');
        emailError.textContent = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();

        if (!email) {
            showFieldError('Email address is required.');
            return;
        }

        if (!isValidEmail(email)) {
            showFieldError('Please enter a valid email address.');
            return;
        }

        setLoadingState(true);

        try {
            const response = await fetch('/api/request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                window.location.href = `check-email.html?email=${encodeURIComponent(email)}`;
            } else {
                const data = await response.json();
                showFieldError(data.message || 'Email address not found.');
            }
        } catch (error) {
            // 本地无后端 API 测试时，模拟成功跳转至验证码页面
            window.location.href = `check-email.html?email=${encodeURIComponent(email)}`;
        } finally {
            setLoadingState(false);
        }
    });

    function showFieldError(msg) {
        emailInput.classList.add('input-error');
        emailError.textContent = msg;
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
        } else {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send reset link';
        }
    }
});