import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import bcryptjs from 'bcryptjs';
import { AUTH_SECRET, SESSION_TTL_MS, ROLES } from './config.mjs';
import { asString } from './utils.mjs';

export { randomUUID };

const BCRYPT_ROUNDS = 10;
const LEGACY_SHA256_RE = /^[a-f0-9]{64}$/i;

export const hashPassword = (plain) => bcryptjs.hash(String(plain), BCRYPT_ROUNDS);
export const verifyPassword = (plain, hash) => {
    if (!hash) return Promise.resolve(false);
    if (LEGACY_SHA256_RE.test(String(hash))) {
        const digest = createHash('sha256').update(String(plain)).digest('hex');
        return Promise.resolve(safeCompare(digest, hash));
    }
    return bcryptjs.compare(String(plain), String(hash));
};

export const safeCompare = (left, right) => {
    const a = Buffer.from(asString(left));
    const b = Buffer.from(asString(right));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
};

export const normaliseRole = (value) => (ROLES.includes(value) ? value : null);

const signTokenBase = (base) =>
    createHmac('sha256', AUTH_SECRET).update(base).digest('base64url');

export const createSessionToken = ({ restaurantId, role = null }) => {
    const payload = Buffer.from(
        JSON.stringify({
            restaurantId,
            role: normaliseRole(role),
            exp: Date.now() + SESSION_TTL_MS,
        }),
    ).toString('base64url');

    return `${payload}.${signTokenBase(payload)}`;
};

export const verifySessionToken = (token) => {
    if (!token) return null;

    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    if (!safeCompare(signTokenBase(payload), signature)) return null;

    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!parsed?.restaurantId || !('role' in parsed) || !parsed?.exp) return null;
        if (parsed.exp < Date.now()) return null;

        const nextRole = parsed.role == null ? null : normaliseRole(parsed.role);
        if (parsed.role != null && !nextRole) return null;

        return { restaurantId: parsed.restaurantId, role: nextRole, exp: parsed.exp };
    } catch {
        return null;
    }
};
