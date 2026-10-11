/**
 * Applicant Profile Page Utility Functions
 */

// 提取全名的首字母用于 Avatar 头像展示
function getInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'X';
    const names = fullName.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

// 格式化求职者电话号码展示格式
function formatPhoneNumber(countryCode, number) {
    if (!number) return 'Not Provided';
    const code = countryCode || '+65';
    return `${code}| ${number}`;
}

// 计算求职者 Profile 的完整度百分比 (%)
function calculateProfileCompletion(profileData) {
    if (!profileData || typeof profileData !== 'object') return 0;
    
    const fields = ['first_name', 'last_name', 'home_location', 'contact_number', 'personal_summary'];
    let completedCount = 0;

    fields.forEach(field => {
        if (profileData[field] && String(profileData[field]).trim() !== '') {
            completedCount++;
        }
    });

    return Math.round((completedCount / fields.length) * 100);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getInitials,
        formatPhoneNumber,
        calculateProfileCompletion
    };
}