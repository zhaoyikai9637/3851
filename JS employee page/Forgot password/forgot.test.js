const { isValidEmail, validateForgotForm } = require('./forgot_utils');

describe('Aim A - Reset Password Unit Tests', () => {

    test('UT-05: Valid registered email should pass validation', () => {
        expect(validateForgotForm('applicant@example.com')).toBe(true);
    });

    test('UT-06: Empty email should fail validation', () => {
        expect(validateForgotForm('')).toBe(false);
    });

    test('UT-07: Malformed email format should fail validation', () => {
        expect(validateForgotForm('invalid-email-format')).toBe(false);
    });
});