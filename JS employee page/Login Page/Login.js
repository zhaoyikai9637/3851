document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const submitBtn = document.getElementById('loginBtn');

    // Real-time input clearing of errors
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    passwordInput.addEventListener('input', () => clearError(passwordInput, passwordError));

    // Form Submit Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!validateForm(email, password)) {
            return;
        }

        setLoadingState(true);

        try {
            // Replace with your actual backend endpoint (e.g., Node.js/Express or PHP)
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Save token or profile ID to localStorage
                localStorage.setItem('account_id', data.account_id);
                localStorage.setItem('token', data.token);

                // Redirect to Profile Page upon success
                window.location.href = 'profile.html';
            } else {
                showFieldError(emailInput, emailError, data.message || 'Authentication failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showFieldError(emailInput, emailError, 'Unable to connect to server. Please try again later.');
        } finally {
            setLoadingState(false);
        }
    });

    // Client-side Validation Logic
    function validateForm(email, password) {
        let isValid = true;

        if (!email) {
            showFieldError(emailInput, emailError, 'Email address is required.');
            isValid = false;
        } else if (!isValidEmail(email)) {
            showFieldError(emailInput, emailError, 'Please enter a valid email address.');
            isValid = false;
        }

        if (!password) {
            showFieldError(passwordInput, passwordError, 'Password is required.');
            isValid = false;
        } else if (password.length < 6) {
            showFieldError(passwordInput, passwordError, 'Password must be at least 6 characters.');
            isValid = false;
        }

        return isValid;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function showFieldError(inputEl, errorEl, message) {
        inputEl.classList.add('input-error');
        errorEl.textContent = message;
    }

    function clearError(inputEl, errorEl) {
        inputEl.classList.remove('input-error');
        errorEl.textContent = '';
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register/Login';
        }
    }
});