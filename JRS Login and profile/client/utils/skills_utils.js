/**
 * Utility Functions for Skills Drawer
 */

// 添加技能纯函数（防空、防重复、限长）
function addSkill(existingSkills, newSkill) {
    const trimmed = (newSkill || '').trim();
    if (!trimmed) {
        return { success: false, error: 'Skill name cannot be empty.', updatedSkills: existingSkills };
    }
    if (trimmed.length > 50) {
        return { success: false, error: 'Skill name exceeds 50 characters.', updatedSkills: existingSkills };
    }
    const isDuplicate = existingSkills.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
        return { success: false, error: 'Skill has already been added.', updatedSkills: existingSkills };
    }
    return { success: true, updatedSkills: [...existingSkills, trimmed] };
}

// 删除指定索引的技能
function removeSkill(existingSkills, indexToRemove) {
    if (!Array.isArray(existingSkills)) return [];
    return existingSkills.filter((_, idx) => idx !== indexToRemove);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addSkill,
        removeSkill
    };
}