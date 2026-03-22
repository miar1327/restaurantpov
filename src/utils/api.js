/**
 * Shared API request helper — used by both auth.js and storage.js.
 * Reads the session token from localStorage and attaches it as Bearer auth.
 */

import { getSession } from './auth.js';

export const apiRequest = async (path, {
    method = 'GET',
    body,
    auth = true,
    signal,
} = {}) => {
    const headers = {};
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (auth) {
        const session = getSession();
        if (session?.token) {
            headers.Authorization = `Bearer ${session.token}`;
        }
    }

    const response = await fetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error || `Request failed with status ${response.status}.`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
};
