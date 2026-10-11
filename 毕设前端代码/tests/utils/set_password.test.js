/**
 * Unit Tests for Set New Password Page
 */
const { validatePasswordLength, validatePasswordMatch } = require('../../client/utils/set_password_utils');

describe('Aim A - Set New Password Unit Tests', () => {

    test('UT-13: Password length >= 8 should pass validation', () => {
        expect(validatePasswordLength('password123')).toBe(true);
        expect(validatePasswordLength('12345678')).toBe(true);
    });

    test('UT-14: Password length < 8 or empty should fail validation', () => {
        expect(validatePasswordLength('12345')).toBe(false);
        expect(validatePasswordLength('')).toBe(false);
        expect(validatePasswordLength('1234567')).toBe(false);
        expect(validatePasswordLength('密'.repeat(25))).toBe(false);
    });

    test('UT-15: Matching passwords should pass validation', () => {
        expect(validatePasswordMatch('newPassword123', 'newPassword123')).toBe(true);
    });

    test('UT-16: Mismatched passwords should fail validation', () => {
        expect(validatePasswordMatch('newPassword123', 'differentPassword')).toBe(false);
    });
});
