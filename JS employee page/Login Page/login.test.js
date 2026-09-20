const { isValidEmail, validateForm } = require('./login_utils');

describe('Aim A - Candidate Login Unit Tests', () => {

    test('UT-01: Valid email format should return true', () => {
        expect(isValidEmail('applicant@example.com')).toBe(true);
    });

    test('UT-02: Invalid email format should return false', () => {
        expect(isValidEmail('applicantexample.com')).toBe(false);
    });

    test('UT-03: Password length < 6 should fail form validation', () => {
        expect(validateForm('test@example.com', '123')).toBe(false);
    });

    test('UT-04: Valid email and password should pass validation', () => {
        expect(validateForm('test@example.com', 'password123')).toBe(true);
    });
});