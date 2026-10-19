document.addEventListener('DOMContentLoaded', () => {
    const otpBoxes = document.querySelectorAll('.otp-box');
    const otpForm = document.getElementById('otpForm');
    const otpError = document.getElementById('otpError');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const countdownSpan = document.getElementById('countdown');
    const displayEmail = document.getElementById('displayEmail');

    const savedEmail = localStorage.getItem('reset_email') || new URLSearchParams(window.location.search).get('email');
    if (savedEmail && displayEmail) {
        displayEmail.textContent = savedEmail;
    }

    otpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const val = e.target.value;
            if (otpError) otpError.textContent = '';

            if (!/^\d$/.test(val)) {
                e.target.value = '';
                return;
            }

            if (val && index < otpBoxes.length - 1) {
                otpBoxes[index + 1].focus();
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && index > 0) {
                otpBoxes[index - 1].focus();
            }
        });
    });

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

    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpValues = Array.from(otpBoxes).map(b => b.value.trim());
            const code = otpValues.join('');

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
                const response = await fetch('http://127.0.0.1:3001/api/check-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: displayEmail.textContent, code })
                });

                const data = await response.json();

                if (response.ok && data.valid) {
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
