document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const form = $('loginForm'), button = $('loginBtn'), toggle = $('registerToggle');
    const email = $('email'), password = $('password');
    let registering = false, submitted = false;
    ['token', 'account_id', 'user_email', 'userEmail'].forEach(key => localStorage.removeItem(key));
    function feedback(text, success = false) {
        $('formMessage').textContent = text;
        $('formMessage').hidden = !text;
        $('formMessage').classList.toggle('is-success', success);
    }
    function clearErrors() {
        for (const [field, error] of [[email, $('emailError')], [password, $('passwordError')], [$('registerFirstName'), $('registerNameError')]]) {
            error.textContent = ''; field.classList.remove('input-error'); field.removeAttribute('aria-invalid');
        }
        feedback('');
    }
    function fieldError(field, errorId, message) {
        $(errorId).textContent = message;
        field.classList.toggle('input-error', Boolean(message));
        if (message) field.setAttribute('aria-invalid', 'true');
        else field.removeAttribute('aria-invalid');
    }
    function validateFields() {
        const invalid = [];
        function check(field, errorId, message) {
            fieldError(field, errorId, message);
            if (message) invalid.push(field);
        }
        const address = email.value.trim();
        check(email, 'emailError', !address ? 'Required field' : address.length > 150 ? 'Email address must not exceed 150 characters.' : email.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? 'Enter a valid email address.' : '');
        const bytes = new TextEncoder().encode(password.value).length;
        check(password, 'passwordError', !password.value ? 'Required field' : registering && password.value.length < 8 ? 'Use 8 characters or more.' : bytes > 72 ? 'Password must not exceed 72 UTF-8 bytes.' : '');
        if (registering) check($('registerFirstName'), 'registerNameError', !$('registerFirstName').value.trim() ? 'Required field' : '');
        return invalid;
    }
    for (const field of [email, password, $('registerFirstName')]) {
        field.addEventListener('input', () => {
            if (submitted) { feedback(''); validateFields(); }
        });
    }
    function syncMode() {
        $('registerNames').hidden = !registering;
        $('authTitle').textContent = registering ? 'Create account' : 'Log in';
        button.textContent = registering ? 'Create account' : 'Log in';
        toggle.textContent = registering ? 'Log in' : 'Register';
        $('registerPrompt').textContent = registering ? 'Already have an account?' : 'Don’t have an account?';
        $('forgotPasswordLink').hidden = registering;
        password.autocomplete = registering ? 'new-password' : 'current-password';
    }
    toggle.addEventListener('click', () => {
        registering = !registering;
        submitted = false;
        if (registering) {
            email.value = ''; password.value = '';
            password.type = 'password';
            $('togglePassword').setAttribute('aria-pressed', 'false');
            $('togglePassword').setAttribute('aria-label', 'Show password');
            $('passwordSlash').hidden = true;
        }
        clearErrors(); syncMode();
    });
    $('togglePassword').addEventListener('click', () => {
        const visible = password.type === 'password';
        password.type = visible ? 'text' : 'password';
        $('togglePassword').setAttribute('aria-pressed', String(visible));
        $('togglePassword').setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
        $('passwordSlash').hidden = !visible;
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (button.disabled) return;
        clearErrors();
        submitted = true;
        const invalid = validateFields();
        if (invalid.length) { invalid[0].focus(); return; }
        button.disabled = true; toggle.disabled = true;
        try {
            if (registering) {
                await JRS.request('/register', { method: 'POST', body: { email: email.value.trim(), password: password.value,
                    first_name: $('registerFirstName').value, last_name: $('registerLastName').value } });
                registering = false; submitted = false; clearErrors(); syncMode();
                feedback('Account created. You can now log in.', true);
            } else {
                const result = await JRS.request('/login', { method: 'POST', body: { email: email.value.trim(), password: password.value } });
                window.location.href = result.user.role === 'hr' ? '/hr/' : '../profile/profile.html';
            }
        } catch (err) {
            if (!registering && err.status === 401) {
                fieldError(email, 'emailError', 'Invalid email or password.');
                fieldError(password, 'passwordError', 'Invalid email or password.');
            } else if (registering && err.status === 409) {
                fieldError(email, 'emailError', 'This email is already registered. Log in or reset your password.');
            } else if (err.status === 429) {
                feedback('Too many attempts. Please try again later.');
            } else if (!err.status || err.status >= 500) {
                feedback('Unable to connect. Please try again later.');
            } else { feedback(err.message); }
        }
        finally { button.disabled = false; toggle.disabled = false; syncMode(); }
    });
});
