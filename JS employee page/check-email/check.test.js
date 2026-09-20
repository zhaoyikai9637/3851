/**
 * Unit Tests for Check Email (OTP Verification) Page
 */
const { validateOTP, isNumericChar, canResend } = require('./check_utils');

describe('Aim A - Check Email & OTP Verification Unit Tests', () => {

    test('UT-08: Valid 4-digit numeric OTP should pass validation', () => {
        expect(validateOTP(['1', '2', '3', '4'])).toBe(true);
        expect(validateOTP('9876')).toBe(true);
    });

    test('UT-09: OTP with less than 4 digits should fail validation', () => {
        expect(validateOTP(['1', '2', '3'])).toBe(false);
        expect(validateOTP('12')).toBe(false);
        expect(validateOTP('')).toBe(false);
    });

    test('UT-10: OTP containing letters or special characters should fail validation', () => {
        expect(validateOTP('12a4')).toBe(false);
        expect(validateOTP('12#4')).toBe(false);
    });

    test('UT-11: Single numeric character input filter test', () => {
        expect(isNumericChar('5')).toBe(true);
        expect(isNumericChar('a')).toBe(false);
        expect(isNumericChar('12')).toBe(false);
    });

    test('UT-12: Resend timer status check', () => {
        expect(canResend(59)).toBe(false);
        expect(canResend(0)).toBe(true);
    });
});