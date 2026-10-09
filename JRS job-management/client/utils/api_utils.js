/**
 * Utility module for handling API requests to the backend server.
 */

// Base API URL configuration
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Generic fetch wrapper with global error handling.
 * @param {string} endpoint - API endpoint path (e.g., '/jobs')
 * @param {object} options - Fetch configuration options
 * @returns {Promise<any>} Response JSON data
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Default headers for JSON communication
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, config);

        // Handle HTTP response errors (e.g., 404, 500)
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP Error: ${response.status}`);
        }

        // Return empty object for 204 No Content
        if (response.status === 204) {
            return {};
        }

        return await response.json();
    } catch (error) {
        console.error(`[API Request Error] ${options.method || 'GET'} ${url}:`, error.message);
        throw error;
    }
}

/**
 * API Helper Methods
 */
const apiUtils = {
    /**
     * GET request
     * @param {string} endpoint 
     * @param {object} params - Query parameters object
     */
    get: (endpoint, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        return request(fullEndpoint, { method: 'GET' });
    },

    /**
     * POST request
     * @param {string} endpoint 
     * @param {object} data - Payload body
     */
    post: (endpoint, data) => {
        return request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * PUT request
     * @param {string} endpoint 
     * @param {object} data - Payload body
     */
    put: (endpoint, data) => {
        return request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    /**
     * DELETE request
     * @param {string} endpoint 
     */
    delete: (endpoint) => {
        return request(endpoint, { method: 'DELETE' });
    }
};

// Export for Node.js / Jest testing environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiUtils;
}