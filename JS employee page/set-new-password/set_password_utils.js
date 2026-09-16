/**
 * Set New Password Page Utility Functions
 */

// 校验新密码最小长度（不少于 6 位）
function validatePasswordLength(password) {
    return typeof password === 'string' && password.trim().length >= 6;
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