const { submitFeedback } = require('../client/pages/interview-feedback/interviewfeedback');

describe('Interview Feedback Submission Tests', () => {
    test('Should reject submission without overall recommendation', () => {
        const invalidFeedback = { comments: 'Great candidate', recommendation: null };
        const result = submitFeedback(invalidFeedback);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Recommendation is required');
    });

    test('Should successfully submit complete feedback', () => {
        const validFeedback = { comments: 'Excellent skills', recommendation: 'Offer' };
        const result = submitFeedback(validFeedback);
        expect(result.success).toBe(true);
        expect(result.data.recommendation).toBe('Offer');
    });
});