function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm(email, password) {
    if (!email || !isValidEmail(email)) {
        return false;
    }
    if (!password || password.length < 6) {
        return false;
    }
    return true;
}

module.exports = {
    isValidEmail,
    validateForm
};
