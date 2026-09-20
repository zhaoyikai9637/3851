document.addEventListener('DOMContentLoaded', () => {
    const otpBoxes = document.querySelectorAll('.otp-box');
    const otpForm = document.getElementById('otpForm');
    const otpError = document.getElementById('otpError');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const countdownSpan = document.getElementById('countdown');
    const displayEmail = document.getElementById('displayEmail');

    // 1. 优先从 localStorage 获取邮箱，不存在则从 URL 参数读取
    const savedEmail = localStorage.getItem('reset_email') || new URLSearchParams(window.location.search).get('email');
    if (savedEmail && displayEmail) {
        displayEmail.textContent = savedEmail;
    }

    // 2. OTP 输入框自动切焦与退格控制
    otpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const val = e.target.value;
            if (otpError) otpError.textContent = '';
            
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
    let timer = null;
    function startCountdown() {
        let timeLeft = 59;
        if (resendBtn) resendBtn.disabled = true;
        if (countdownSpan) countdownSpan.textContent = timeLeft;

        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            if (countdownSpan) countdownSpan.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(timer);
                if (resendBtn) {
                    resendBtn.disabled = false;
                    resendBtn.innerHTML = 'Resend code';
                }
            }
        }, 1000);
    }
    startCountdown();

    // 4. 点击 Resend 重新向后端请求验证码
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const email = displayEmail ? displayEmail.textContent : '';
            if (!email) return;

            try {
                const response = await fetch('http://127.0.0.1:3001/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                if (data.valid) {
                    if (otpError) otpError.textContent = '';
                    resendBtn.innerHTML = 'Resent (<span id="countdown">59</span>s)';
                    startCountdown();
                } else if (otpError) {
                    otpError.textContent = data.error || 'Failed to resend code.';
                }
            } catch (err) {
                if (otpError) otpError.textContent = 'Server connection error.';
            }
        });
    }

    // 5. 表单提交验证并对接后端 API
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpValues = Array.from(otpBoxes).map(b => b.value.trim());
            const code = otpValues.join('');
            
            // 如果 check_utils.js 中定义了 validateOTP，优先调用；否则使用默认长度校验
            const isCodeValid = typeof validateOTP === 'function' ? validateOTP(otpValues) : code.length === 4;

            if (!isCodeValid) {
                if (otpError) otpError.textContent = 'Please enter a valid 4-digit code.';
                return;
            }

            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'Verifying...';
            }

            try {
                // 调用后端 Node.js 校验接口
                const response = await fetch('http://127.0.0.1:3001/api/check-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: displayEmail.textContent, code })
                });

                const data = await response.json();

                if (response.ok && data.valid) {
                    // 校验成功，跳转至 set-new-password 文件夹下的 set-new-password.html
                    window.location.href = '../set-new-password/set-new-password.html';
                } else {
                    if (otpError) otpError.textContent = data.error || 'Invalid verification code. Please try again.';
                }
            } catch (err) {
                if (otpError) otpError.textContent = 'Cannot connect to server. Please check if backend is running.';
            } finally {
                if (verifyBtn) {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify code';
                }
            }
        });
    }
});