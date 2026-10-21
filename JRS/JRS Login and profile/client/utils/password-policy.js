/* Shared creation policy. Login deliberately continues to accept legacy passwords. */
(function (root) {
    function passwordPolicyError(value) {
        if (typeof value !== 'string' || value.length < 8 || value.length > 72) {
            return 'Use 8 to 72 characters.';
        }
        if (/[^\x20-\x7e]/.test(value)) {
            return 'Use English letters, numbers and ASCII symbols only.';
        }
        if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9 ]/.test(value)) {
            return 'Include an uppercase letter, a lowercase letter, a number and a special symbol.';
        }
        return '';
    }
    const policy = {passwordPolicyError};
    if (typeof module !== 'undefined' && module.exports) module.exports = policy;
    else root.JRSPasswordPolicy = policy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
