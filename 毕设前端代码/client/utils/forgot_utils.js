function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForgotForm(email) {
    if (!email || !isValidEmail(email)) {
        return false;
    }
    return true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isValidEmail,
        validateForgotForm
    };
}