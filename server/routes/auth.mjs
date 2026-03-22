import { httpError, sendJson, readJsonBody, normaliseEmail, trimmed, asString, nowIso, validateEmail } from '../utils.mjs';
import { verifyPassword, hashPassword, normaliseRole, createSessionToken } from '../crypto.mjs';
import { readAuthDb, writeAuthDb } from '../db/auth.mjs';
import { requireSession } from '../middleware.mjs';
import { publicProfile } from './profiles.mjs';
import { issueResetCodeForProfile } from '../email.mjs';

const ensureMasterKeyLength = (masterKey) => {
    if (String(masterKey ?? '').length < 6) throw httpError(400, 'Master key must be at least 6 characters.');
};
const ensurePinLength = (label, pin) => {
    if (String(pin ?? '').length < 4) throw httpError(400, `${label} PIN must be at least 4 characters.`);
};

const handleAuthResponse = (res, profile, role = null) => {
    sendJson(res, 200, {
        token: createSessionToken({ restaurantId: profile.id, role }),
        role: normaliseRole(role),
        profile: publicProfile(profile, { includeEmail: true, includeRoleConfig: true }),
    });
};

const sendMasterKeySetupRequired = (res, profile, message) => {
    sendJson(res, 409, {
        error: message,
        action: 'master_key_setup_required',
        email: profile.email,
    });
};

const resolveRolePin = (profile, role) => {
    if (role === 'admin') {
        return { enabled: profile.admin_pin_enabled !== false, hash: profile.admin_pin_hash, label: 'Admin' };
    }
    return { enabled: profile.waiter_pin_enabled !== false, hash: profile.waiter_pin_hash, label: 'Waiter' };
};

export const handleAuth = async (req, res, pathname) => {
    // POST /api/auth/login
    if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(req);
        const identifier = normaliseEmail(body.identifier ?? body.email);
        const masterKey = asString(body.masterKey ?? body.password);
        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.email === identifier || e.id === identifier);

        if (!profile) throw httpError(404, 'Restaurant profile not found.');
        if (!profile.master_key_hash) {
            await issueResetCodeForProfile(db, profile);
            sendMasterKeySetupRequired(
                res,
                profile,
                'This restaurant profile does not have a master key yet. We sent a reset code to the restaurant email so you can set one now.',
            );
            return true;
        }
        if (!await verifyPassword(masterKey, profile.master_key_hash)) {
            throw httpError(401, 'Incorrect master key. Try again.');
        }

        handleAuthResponse(res, profile, null);
        return true;
    }

    // POST /api/auth/select-role
    if (req.method === 'POST' && pathname === '/api/auth/select-role') {
        const session = requireSession(req);
        const body = await readJsonBody(req);
        const role = normaliseRole(body.role);
        if (!role) throw httpError(400, 'Choose a valid role.');

        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.id === session.restaurantId);
        if (!profile) throw httpError(401, 'Session is no longer valid.');

        const rolePin = resolveRolePin(profile, role);
        if (rolePin.enabled) {
            const pin = asString(body.pin);
            if (!pin) throw httpError(400, `${rolePin.label} PIN is required.`);
            if (!await verifyPassword(pin, rolePin.hash)) {
                throw httpError(401, `Incorrect ${rolePin.label.toLowerCase()} PIN.`);
            }
        }

        handleAuthResponse(res, profile, role);
        return true;
    }

    // POST /api/auth/clear-role
    if (req.method === 'POST' && pathname === '/api/auth/clear-role') {
        const session = requireSession(req);
        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.id === session.restaurantId);
        if (!profile) throw httpError(401, 'Session is no longer valid.');
        handleAuthResponse(res, profile, null);
        return true;
    }

    // GET /api/auth/session
    if (req.method === 'GET' && pathname === '/api/auth/session') {
        const session = requireSession(req);
        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.id === session.restaurantId);
        if (!profile) throw httpError(401, 'Session is no longer valid.');
        sendJson(res, 200, {
            role: session.role,
            profile: publicProfile(profile, { includeEmail: true, includeRoleConfig: true }),
        });
        return true;
    }

    // POST /api/auth/request-reset
    if (req.method === 'POST' && pathname === '/api/auth/request-reset') {
        const body = await readJsonBody(req);
        const email = normaliseEmail(body.email);
        if (!email) throw httpError(400, 'Email is required.');
        if (!validateEmail(email)) throw httpError(400, 'Enter a valid email address.');

        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.email === email);
        if (profile) await issueResetCodeForProfile(db, profile);

        sendJson(res, 200, { message: 'If a restaurant with that email exists, a reset code has been sent.' });
        return true;
    }

    // POST /api/auth/reset-password
    if (req.method === 'POST' && pathname === '/api/auth/reset-password') {
        const body = await readJsonBody(req);
        const email = normaliseEmail(body.email);
        const code = trimmed(body.code);
        const nextMasterKey = body.masterKey ? asString(body.masterKey) : '';
        const nextAdminPin = body.adminPin ? asString(body.adminPin) : '';
        const nextWaiterPin = body.waiterPin ? asString(body.waiterPin) : '';

        if (!email) throw httpError(400, 'Email is required.');
        if (!validateEmail(email)) throw httpError(400, 'Enter a valid email address.');
        if (!code) throw httpError(400, 'Reset code is required.');
        if (!nextMasterKey && !nextAdminPin && !nextWaiterPin) {
            throw httpError(400, 'Enter at least one credential to reset.');
        }
        if (nextMasterKey) ensureMasterKeyLength(nextMasterKey);
        if (nextAdminPin) ensurePinLength('Admin', nextAdminPin);
        if (nextWaiterPin) ensurePinLength('Waiter', nextWaiterPin);

        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.email === email);
        if (
            !profile ||
            !profile.reset_code_hash ||
            !profile.reset_code_expires_at ||
            new Date(profile.reset_code_expires_at).getTime() < Date.now() ||
            !await verifyPassword(code, profile.reset_code_hash)
        ) {
            throw httpError(400, 'The reset code is invalid or has expired.');
        }

        if (nextMasterKey) profile.master_key_hash = await hashPassword(nextMasterKey);
        if (nextAdminPin) profile.admin_pin_hash = await hashPassword(nextAdminPin);
        if (nextWaiterPin) profile.waiter_pin_hash = await hashPassword(nextWaiterPin);
        profile.reset_code_hash = null;
        profile.reset_code_expires_at = null;
        profile.updated_at = nowIso();

        await writeAuthDb(db);
        sendJson(res, 200, { message: 'Restaurant access credentials updated successfully.' });
        return true;
    }

    return false;
};
