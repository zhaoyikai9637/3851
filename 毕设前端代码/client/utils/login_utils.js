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

// 必须添加 module.exports 供 Jest 调用
module.exports = {
    isValidEmail,
    validateForm
};