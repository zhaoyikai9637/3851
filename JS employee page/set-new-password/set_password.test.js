/**
 * Unit Tests for Set New Password Page
 */
const { validatePasswordLength, validatePasswordMatch } = require('./set_password_utils');

describe('Aim A - Set New Password Unit Tests', () => {

    test('UT-13: Password length >= 6 should pass validation', () => {
        expect(validatePasswordLength('password123')).toBe(true);
        expect(validatePasswordLength('123456')).toBe(true);
    });

    test('UT-14: Password length < 6 or empty should fail validation', () => {
        expect(validatePasswordLength('12345')).toBe(false);
        expect(validatePasswordLength('')).toBe(false);
    });

    test('UT-15: Matching passwords should pass validation', () => {
        expect(validatePasswordMatch('newPassword123', 'newPassword123')).toBe(true);
    });

    test('UT-16: Mismatched passwords should fail validation', () => {
        expect(validatePasswordMatch('newPassword123', 'differentPassword')).toBe(false);
    });
});