import { httpError } from './utils.mjs';
import { verifySessionToken } from './crypto.mjs';

export const getBearerToken = (req) => {
    const header = req.headers.authorization ?? '';
    return header.startsWith('Bearer ') ? header.slice(7) : null;
};

export const requireSession = (req) => {
    const session = verifySessionToken(getBearerToken(req));
    if (!session) throw httpError(401, 'Please sign in again.');
    return session;
};

export const requireAdmin = (req) => {
    const session = requireSession(req);
    if (session.role !== 'admin') throw httpError(403, 'Admin access required.');
    return session;
};
