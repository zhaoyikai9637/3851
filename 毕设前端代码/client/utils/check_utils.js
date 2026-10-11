/**
 * Check Email Page Utility Functions
 */

// 校验 4 位数字验证码格式
function validateOTP(otp) {
    const code = Array.isArray(otp) ? otp.join('') : String(otp || '');
    return /^\d{4}$/.test(code.trim());
}

// 校验输入字符是否为单个数字
function isNumericChar(char) {
    return /^\d$/.test(char);
}

// 校验倒计时是否允许重新发送
function canResend(timeLeft) {
    return typeof timeLeft === 'number' && timeLeft <= 0;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateOTP,
        isNumericChar,
        canResend
    };
}