/**
 * Set New Password Page Utility Functions
 */

// Match the server creation/reset policy; preserve intentional spaces.
function validatePasswordLength(password) {
    return typeof password === 'string' && password.length >= 8 && new TextEncoder().encode(password).length <= 72;
}

// 校验新密码与确认密码是否一致
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
