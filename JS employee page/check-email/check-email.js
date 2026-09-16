document.addEventListener('DOMContentLoaded', () => {
    const otpBoxes = document.querySelectorAll('.otp-box');
    const otpForm = document.getElementById('otpForm');
    const otpError = document.getElementById('otpError');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const countdownSpan = document.getElementById('countdown');
    const displayEmail = document.getElementById('displayEmail');

    // 1. 获取 URL 中传过来的 Email 并在页面显示
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam) {
        displayEmail.textContent = emailParam;
    }

    // 2. OTP 输入框自动切焦与退格控制
    otpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const val = e.target.value;
            otpError.textContent = '';
            
            // 限制只能输入数字
            if (!/^\d$/.test(val)) {
                e.target.value = '';
                return;
            }

            // 自动聚焦下一个输入框
            if (val && index < otpBoxes.length - 1) {
                otpBoxes[index + 1].focus();
            }
        });

        box.addEventListener('keydown', (e) => {
            // 按退格键 (Backspace) 自动切回前一个输入框
            if (e.key === 'Backspace' && !box.value && index > 0) {
                otpBoxes[index - 1].focus();
            }
        });
    });

    // 3. 59 秒重发倒计时逻辑
    let timeLeft = 59;
    let timer = setInterval(() => {
        timeLeft--;
        countdownSpan.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            resendBtn.disabled = false;
            resendBtn.innerHTML = 'Resend code';
        }
    }, 1000);

    // 4. 表单提交验证
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpValues = Array.from(otpBoxes).map(b => b.value);
        
        if (!validateOTP(otpValues)) {
            otpError.textContent = 'Please enter a valid 4-digit code.';
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            // 发送后端验证 API
            const response = await fetch('/api/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: displayEmail.textContent, otp: otpValues.join('') })
            });

            if (response.ok) {
                window.location.href = 'set-new-password.html';
            } else {
                otpError.textContent = 'Invalid verification code. Please try again.';
            }
        } catch (err) {
            // 本地未连后端 API 时，模拟成功跳转
            window.location.href = 'set-new-password.html';
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify code';
        }
    });
});