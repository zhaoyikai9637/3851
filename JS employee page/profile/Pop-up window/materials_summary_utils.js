/**
 * Utility Functions for Editing Materials & Personal Summary Modals
 */

// 校验基本资料表单输入
function validateMaterialsInputs(firstName, lastName, homeLocation, contactNumber) {
    if (!firstName || !firstName.trim()) {
        return { valid: false, error: 'First name is required.' };
    }
    if (!lastName || !lastName.trim()) {
        return { valid: false, error: 'Last name is required.' };
    }
    if (!homeLocation || !homeLocation.trim()) {
        return { valid: false, error: 'Home location is required.' };
    }
    // 允许带 + 号和空格/短横线的电话格式
    if (!contactNumber || !/^\+?[\d\s-]{7,15}$/.test(contactNumber.trim())) {
        return { valid: false, error: 'Please enter a valid contact number.' };
    }
    return { valid: true };
}

// 校验个人总结输入文本
function validateSummaryInput(summaryText) {
    const trimmed = (summaryText || '').trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Personal summary cannot be empty.' };
    }
    if (trimmed.length > 2000) {
        return { valid: false, error: 'Summary exceeds maximum limit of 2000 characters.' };
    }
    return { valid: true };
}

// 敏感个人信息关键词检测（响应 UI 上的 Stay safe 安全提示）
function hasSensitiveKeywords(text) {
    if (!text || typeof text !== 'string') return false;
    const sensitiveRegex = /(nric|passport|bank account|credit card|ssn|identity document)/i;
    return sensitiveRegex.test(text);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateMaterialsInputs,
        validateSummaryInput,
        hasSensitiveKeywords
    };
}