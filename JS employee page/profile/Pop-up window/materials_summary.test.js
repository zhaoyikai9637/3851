/**
 * Unit Tests for Materials & Personal Summary Modals
 */
const { 
    validateMaterialsInputs, 
    validateSummaryInput, 
    hasSensitiveKeywords 
} = require('./materials_summary_utils');

describe('Aim A - Materials & Personal Summary Modals Unit Tests', () => {

    test('UT-21: Valid materials input should pass validation', () => {
        const result = validateMaterialsInputs('Alex', 'Tan', 'Bedok', '+65 91234567');
        expect(result.valid).toBe(true);
    });

    test('UT-22: Missing first name should fail materials validation', () => {
        const result = validateMaterialsInputs('', 'Tan', 'Bedok', '+65 91234567');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('First name is required.');
    });

    test('UT-23: Invalid contact number format should fail validation', () => {
        expect(validateMaterialsInputs('Alex', 'Tan', 'Bedok', 'abc123').valid).toBe(false);
        expect(validateMaterialsInputs('Alex', 'Tan', 'Bedok', '123').valid).toBe(false);
    });

    test('UT-24: Personal summary exceeding character limit should fail', () => {
        const longText = 'a'.repeat(2001);
        const result = validateSummaryInput(longText);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Summary exceeds maximum limit of 2000 characters.');
    });

    test('UT-25: Should correctly flag sensitive personal keywords', () => {
        expect(hasSensitiveKeywords('My passport number is S1234567A')).toBe(true);
        expect(hasSensitiveKeywords('My NRIC is T0123456B')).toBe(true);
        expect(hasSensitiveKeywords('Passionate software developer with 3 years experience.')).toBe(false);
    });
});

const { validatePhoneNumberLength, validateSummaryInput } = require('./materials_summary_utils');

describe('Aim A - Materials and Summary Drawer Unit Tests', () => {

    test('UT-35: Should pass validation for correct Singapore phone number length (8 digits)', () => {
        expect(validatePhoneNumberLength('+65', '91234567').valid).toBe(true);
    });

    test('UT-36: Should reject invalid Singapore phone number length', () => {
        const res = validatePhoneNumberLength('+65', '912345');
        expect(res.valid).toBe(false);
        expect(res.error).toBe('Phone number for +65 must be 8 digits.');
    });

    test('UT-37: Should pass validation for correct China phone number length (11 digits)', () => {
        expect(validatePhoneNumberLength('+86', '13812345678').valid).toBe(true);
    });

    test('UT-38: Should reject non-empty summary input', () => {
        expect(validateSummaryInput('  ').valid).toBe(false);
    });
});