const { addSkill, removeSkill } = require('./skills_utils');

describe('Aim A - Add Skills Dynamic Drawer Unit Tests', () => {

    test('UT-26: Should successfully add a valid unique skill', () => {
        const initial = ['HTML', 'CSS'];
        const result = addSkill(initial, 'JavaScript');
        expect(result.success).toBe(true);
        expect(result.updatedSkills).toEqual(['HTML', 'CSS', 'JavaScript']);
    });

    test('UT-27: Should reject empty or whitespace skill name', () => {
        const result = addSkill([], '   ');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Skill name cannot be empty.');
    });

    test('UT-28: Should prevent adding duplicate skills (case-insensitive)', () => {
        const initial = ['JavaScript'];
        const result = addSkill(initial, 'javascript');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Skill has already been added.');
    });

    test('UT-29: Should correctly remove a skill by index', () => {
        const initial = ['React', 'Node.js', 'Jest'];
        const updated = removeSkill(initial, 1); // remove Node.js
        expect(updated).toEqual(['React', 'Jest']);
    });
});