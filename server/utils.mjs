// Shared pure helpers — no Node I/O, no side-effects.

export const normaliseEmail = (value = '') => String(value ?? '').trim().toLowerCase();
export const asString = (value) => String(value ?? '');
export const trimmed = (value) => asString(value).trim();
export const nullableTrimmed = (value) => {
    const next = trimmed(value);
    return next || null;
};
export const asNumber = (value, fallback = 0) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
};
export const asBoolean = (value, fallback = false) =>
    typeof value === 'boolean' ? value : fallback;
export const nowIso = () => new Date().toISOString();
export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const isValidBusinessDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(asString(value));

export const httpError = (statusCode, message) =>
    Object.assign(new Error(message), { statusCode });

export const sendJson = (res, statusCode, payload) => {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
};

export const readJsonBody = (req) =>
    new Promise((resolve, reject) => {
        let raw = '';

        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 1_000_000) {
                reject(httpError(413, 'Request body too large.'));
                req.destroy();
            }
        });

        req.on('end', () => {
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(httpError(400, 'Invalid JSON body.'));
            }
        });

        req.on('error', reject);
    });
