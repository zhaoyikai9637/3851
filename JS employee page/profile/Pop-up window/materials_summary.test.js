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