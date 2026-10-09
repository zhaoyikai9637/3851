const { initialInterviews, filterInterviews } = require('../client/pages/interview-schedule/interviewschedule');

describe('Interview Schedule Module Tests', () => {
    test('Should filter interviews by selected date', () => {
        const result = filterInterviews(initialInterviews, '', '2026-07-30', '');
        expect(result.length).toBe(1);
        expect(result[0].candidate).toBe('Mary Smith');
    });

    test('Should filter interviews by both status and date', () => {
        const result = filterInterviews(initialInterviews, '', '2026-07-29', 'Confirmed');
        expect(result.length).toBe(1);
        expect(result[0].candidate).toBe('Jane Doe');
    });
});