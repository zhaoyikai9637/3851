const { 
    getInitials, 
    formatPhoneNumber, 
    calculateProfileCompletion 
} = require('./profile_utils');

describe('Aim A - Applicant Profile Dashboard Unit Tests', () => {

    test('UT-17: Should generate correct initials from full name', () => {
        expect(getInitials('John Doe')).toBe('JD');
        expect(getInitials('Alex')).toBe('A');
        expect(getInitials('')).toBe('X');
    });

    test('UT-18: Should format phone number correctly', () => {
        expect(formatPhoneNumber('+65', '98765432')).toBe('+65| 98765432');
        expect(formatPhoneNumber('', '')).toBe('Not Provided');
    });

    test('UT-19: Should calculate 100% completion for complete profile', () => {
        const fullProfile = {
            first_name: 'John',
            last_name: 'Doe',
            home_location: 'Singapore',
            contact_number: '91234567',
            personal_summary: 'Full stack developer'
        };
        expect(calculateProfileCompletion(fullProfile)).toBe(100);
    });

    test('UT-20: Should calculate partial completion percentage correctly', () => {
        const partialProfile = {
            first_name: 'John',
            last_name: 'Doe',
            home_location: '',
            contact_number: '',
            personal_summary: ''
        };
        expect(calculateProfileCompletion(partialProfile)).toBe(40);
    });
});