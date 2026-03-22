import { apiRequest } from './api.js';

const SESSION_KEY = 'rms_session';

const asString = (value) => (value == null ? '' : String(value));
const normaliseEmail = (value = '') => asString(value).trim().toLowerCase();

const saveSession = ({ token, role = null, profile }) => {
    const session = {
        token,
        role: role ?? null,
        restaurantId: profile.id,
        profile,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
};

export const validateEmail = (value) => {
    const email = normaliseEmail(value);
    if (!email) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'Enter a valid email address.';
    }
    return null;
};

export const validateMasterKey = (value) => {
    if (asString(value).length < 6) {
        return 'Master key must be at least 6 characters.';
    }
    return null;
};

export const validateRolePin = (label, value, { required = true } = {}) => {
    const pin = asString(value);
    if (!pin && !required) return null;
    if (pin.length < 4) {
        return `${label} PIN must be at least 4 characters.`;
    }
    return null;
};

export const getSession = () => {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed?.token || !parsed?.restaurantId || !parsed?.profile) {
            return null;
        }

        return {
            token: parsed.token,
            role: parsed.role ?? null,
            restaurantId: parsed.restaurantId,
            profile: parsed.profile,
        };
    } catch {
        return null;
    }
};

export const clearSession = () => localStorage.removeItem(SESSION_KEY);

export const restoreSession = async () => {
    const saved = getSession();
    if (!saved?.token) return null;

    try {
        const payload = await apiRequest('/api/auth/session', { auth: true });
        return saveSession({
            token: saved.token,
            role: payload.role ?? null,
            profile: payload.profile,
        });
    } catch {
        clearSession();
        return null;
    }
};

export const getProfiles = async (options = {}) => {
    const path = options.includeEmail ? '/api/profiles/manage' : '/api/profiles';
    const payload = await apiRequest(path, { auth: options.includeEmail });
    return payload.profiles ?? [];
};

export const createProfile = async (data) => {
    const payload = await apiRequest('/api/profiles', {
        method: 'POST',
        body: {
            name: data.name,
            email: normaliseEmail(data.email),
            address: data.address ?? '',
            phone: data.phone ?? '',
            masterKey: data.masterKey,
            adminPin: data.adminPin,
            waiterPin: data.waiterPin,
            adminPinEnabled: data.adminPinEnabled ?? true,
            waiterPinEnabled: data.waiterPinEnabled ?? true,
        },
    });

    return payload.profile;
};

export const updateProfile = async (id, data) => {
    const payload = await apiRequest(`/api/profiles/${id}`, {
        method: 'PATCH',
        auth: true,
        body: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.email !== undefined ? { email: normaliseEmail(data.email) } : {}),
            ...(data.address !== undefined ? { address: data.address } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.masterKey ? { masterKey: data.masterKey } : {}),
            ...(data.adminPin ? { adminPin: data.adminPin } : {}),
            ...(data.waiterPin ? { waiterPin: data.waiterPin } : {}),
            ...(data.adminPinEnabled !== undefined ? { adminPinEnabled: data.adminPinEnabled } : {}),
            ...(data.waiterPinEnabled !== undefined ? { waiterPinEnabled: data.waiterPinEnabled } : {}),
        },
    });

    const session = getSession();
    if (session?.restaurantId === id) {
        saveSession({
            token: session.token,
            role: session.role,
            profile: payload.profile,
        });
    }

    return payload.profile;
};

export const deleteProfile = async (id) => {
    await apiRequest(`/api/profiles/${id}`, {
        method: 'DELETE',
        auth: true,
    });

    const session = getSession();
    if (session?.restaurantId === id) {
        clearSession();
    }
};

export const tryLogin = async (identifier, masterKey) => {
    try {
        const payload = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: { identifier, masterKey },
        });

        const session = saveSession({
            token: payload.token,
            role: payload.role ?? null,
            profile: payload.profile,
        });

        return {
            ok: true,
            role: session.role,
            profile: session.profile,
            token: session.token,
        };
    } catch (error) {
        return {
            ok: false,
            error: error.message ?? 'Unable to sign in.',
            action: error?.payload?.action ?? null,
            email: error?.payload?.email ?? null,
        };
    }
};

export const selectRole = async (role, pin = '') => {
    const payload = await apiRequest('/api/auth/select-role', {
        method: 'POST',
        auth: true,
        body: { role, pin },
    });

    return saveSession({
        token: payload.token,
        role: payload.role ?? null,
        profile: payload.profile,
    });
};

export const clearRoleSelection = async () => {
    const payload = await apiRequest('/api/auth/clear-role', {
        method: 'POST',
        auth: true,
    });

    return saveSession({
        token: payload.token,
        role: payload.role ?? null,
        profile: payload.profile,
    });
};

export const requestPasswordReset = async (email) =>
    apiRequest('/api/auth/request-reset', {
        method: 'POST',
        body: { email: normaliseEmail(email) },
    });

export const resetPasswordWithCode = async ({ email, code, masterKey, adminPin, waiterPin }) =>
    apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: {
            email: normaliseEmail(email),
            code,
            ...(masterKey ? { masterKey } : {}),
            ...(adminPin ? { adminPin } : {}),
            ...(waiterPin ? { waiterPin } : {}),
        },
    });
