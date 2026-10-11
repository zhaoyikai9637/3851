document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm'), button = document.getElementById('loginBtn');
    const toggle = document.getElementById('registerToggle'), names = document.getElementById('registerNames');
    const error = document.getElementById('emailError');
    let registering = false;
    // Retire the old, untrusted client-side identity values.
    ['token', 'account_id', 'user_email', 'userEmail'].forEach(key => localStorage.removeItem(key));
    toggle.addEventListener('click', () => {
        registering = !registering;
        names.hidden = !registering;
        button.textContent = registering ? 'Create account' : 'Log in';
        toggle.textContent = registering ? 'Already have an account? Log in' : 'Create a candidate account';
        error.textContent = '';
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        error.textContent = '';
        if (button.disabled) return;
        button.disabled = true;
        toggle.disabled = true;
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value; // Passwords are never trimmed.
        try {
            if (registering) {
                await JRS.request('/register', { method: 'POST', body: { email, password,
                    first_name: document.getElementById('registerFirstName').value,
                    last_name: document.getElementById('registerLastName').value } });
                registering = false; names.hidden = true;
                toggle.textContent = 'Create a candidate account';
                error.textContent = 'Account created. You can now log in.';
            } else {
                await JRS.request('/login', { method: 'POST', body: { email, password } });
                window.location.href = '../profile/profile.html';
            }
        } catch (err) { error.textContent = err.message; }
        finally { button.disabled = false; toggle.disabled = false; button.textContent = registering ? 'Create account' : 'Log in'; }
    });
});
