/* Shared creation policy. Login deliberately continues to accept legacy passwords. */
(function (root) {
    function passwordPolicyError(value) {
        if (typeof value !== 'string') return 'Enter a password.';
        const errors = [];
        if (value.length < 8) errors.push('Use at least 8 characters.');
        // Accepted passwords are ASCII, so each character occupies one UTF-8 byte.
        if (value.length > 72) errors.push('Password is too long. Use a shorter password.');
        if (/[^\x20-\x7e]/.test(value)) {
            errors.push('Use English letters, numbers and ASCII symbols only.');
        }
        if (!/[a-z]/.test(value)) errors.push('Add at least one lowercase letter.');
        if (!/[A-Z]/.test(value)) errors.push('Add at least one uppercase letter.');
        if (!/[0-9]/.test(value)) errors.push('Add at least one number.');
        return errors.join(' ');
    }
    const policy = {passwordPolicyError};
    if (typeof module !== 'undefined' && module.exports) module.exports = policy;
    else root.JRSPasswordPolicy = policy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
