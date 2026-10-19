/* Same-origin API client. Authentication lives in an HttpOnly cookie. */
window.JRS = (() => {
    let csrfToken = '';
    async function request(url, options = {}) {
        const headers = { ...(options.headers || {}) };
        let body = options.body;
        if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
        const response = await fetch(`/api${url}`, { ...options, headers, body, credentials: 'same-origin' });
        let data;
        try { data = await response.json(); } catch { throw new Error('Unexpected server response. Open this page through the JRS server.'); }
        if (!response.ok || !data.valid) { const error = new Error(data.error || 'Request failed.'); error.status = response.status; throw error; }
        if (data.csrfToken) csrfToken = data.csrfToken;
        return data;
    }
    return { request };
})();
