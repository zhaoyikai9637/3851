document.addEventListener('DOMContentLoaded', () => {
    const boxes = [...document.querySelectorAll('.otp-box')], error = document.getElementById('otpError');
    const verify = document.getElementById('verifyBtn'), resend = document.getElementById('resendBtn');
    const email = sessionStorage.getItem('reset_email');
    if (!email) { window.location.replace('../forgot-password/forgot-password.html'); return; }
    document.getElementById('displayEmail').textContent = email;
    const assistanceMode = sessionStorage.getItem('reset_mode') === 'email';
    const linkMode = assistanceMode || sessionStorage.getItem('reset_mode') === 'link';
    if(linkMode) {
        document.querySelector('.auth-subtitle').textContent = assistanceMode
            ? 'Check your inbox and spam folder for account assistance instructions.'
            : 'If an eligible account exists, a single-use reset link will be sent. Check your inbox and spam folder. The link expires in 10 minutes.';
        document.querySelector('.otp-container').hidden = true;
        verify.hidden = true;
        document.querySelector('.resend-container span').textContent = assistanceMode ? 'Need another email?' : 'Need another link?';
    }
    let timer;
    function countdown() {
        clearInterval(timer);
        const deadline = Date.now() + 60000;
        resend.disabled = true;
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            const label = assistanceMode ? 'Resend email' : linkMode ? 'Resend link' : 'Resend code';
            resend.textContent = remaining ? `${label} (${remaining}s)` : label;
            if (!remaining) { clearInterval(timer); resend.disabled = false; }
        };
        tick(); timer = setInterval(tick, 1000);
    }
    countdown();
    boxes.forEach((box, i) => {
        box.addEventListener('input', () => { box.value = box.value.replace(/\D/g, '').slice(0, 1); if (box.value) boxes[i + 1]?.focus(); });
        box.addEventListener('keydown', event => { if (event.key === 'Backspace' && !box.value) boxes[i - 1]?.focus(); });
    });
    resend.addEventListener('click', async () => {
        resend.disabled = true; error.textContent = '';
        try { await JRS.request('/forgot-password', { method: 'POST', body: { email } }); sessionStorage.removeItem('reset_token'); countdown(); }
        catch (err) { error.textContent = err.message; resend.disabled = false; }
    });
    document.getElementById('otpForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (verify.disabled || linkMode) return;
        verify.disabled = true; error.textContent = '';
        try {
            const data = await JRS.request('/check-email', { method: 'POST', body: { email, code: boxes.map(b => b.value).join('') } });
            sessionStorage.setItem('reset_token', data.resetToken);
            window.location.href = '../set-new-password/set-new-password.html';
        } catch (err) { error.textContent = err.message; }
        finally { verify.disabled = false; }
    });
    window.addEventListener('pagehide', () => clearInterval(timer));
});
