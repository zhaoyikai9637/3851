/**
 * Check Email Page Utility Functions
 */

function validateOTP(otp) {
    const code = Array.isArray(otp) ? otp.join('') : String(otp || '');
    return /^\d{4}$/.test(code.trim());
}

function isNumericChar(char) {
    return /^\d$/.test(char);
}

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
