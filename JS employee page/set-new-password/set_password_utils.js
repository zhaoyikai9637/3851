/**
 * Set New Password Page Utility Functions
 */

function validatePasswordLength(password) {
    return typeof password === 'string' && password.trim().length >= 6;
}

function validatePasswordMatch(newPassword, confirmPassword) {
    if (!validatePasswordLength(newPassword)) {
        return false;
    }
    return newPassword === confirmPassword;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validatePasswordLength,
        validatePasswordMatch
    };
}
