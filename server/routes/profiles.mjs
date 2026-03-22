import { randomUUID } from 'node:crypto';
import { httpError, sendJson, readJsonBody, normaliseEmail, trimmed, asBoolean, nowIso, validateEmail } from '../utils.mjs';
import { hashPassword, verifyPassword } from '../crypto.mjs';
import { readAuthDb, writeAuthDb, normalizeAuthProfile } from '../db/auth.mjs';
import { readAppDb, writeAppDb, ensureRestaurantData, withAppMutation } from '../db/app.mjs';
import { requireAdmin } from '../middleware.mjs';
import { issueResetCodeForProfile, sendAccountCreationEmail } from '../email.mjs';

const ensureMasterKeyLength = (masterKey) => {
    if (String(masterKey ?? '').length < 6) throw httpError(400, 'Master key must be at least 6 characters.');
};
const ensurePinLength = (label, pin) => {
    if (String(pin ?? '').length < 4) throw httpError(400, `${label} PIN must be at least 4 characters.`);
};

const publicProfile = (profile, { includeEmail = false, includeRoleConfig = false } = {}) => ({
    id: profile.id,
    name: profile.name,
    address: profile.address ?? '',
    phone: profile.phone ?? '',
    ...(includeEmail ? { email: profile.email } : {}),
    ...(includeRoleConfig
        ? {
            adminPinEnabled: profile.admin_pin_enabled !== false,
            waiterPinEnabled: profile.waiter_pin_enabled !== false,
        }
        : {}),
    created_at: profile.created_at,
    updated_at: profile.updated_at ?? null,
});

export { publicProfile };

export const handleProfiles = async (req, res, pathname) => {
    // GET /api/profiles — public list (no auth)
    if (req.method === 'GET' && pathname === '/api/profiles') {
        const db = await readAuthDb();
        sendJson(res, 200, { profiles: db.profiles.map((p) => publicProfile(p)) });
        return true;
    }

    // GET /api/profiles/manage — admin only, own profile with email + role config
    if (req.method === 'GET' && pathname === '/api/profiles/manage') {
        const session = requireAdmin(req);
        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.id === session.restaurantId);
        if (!profile) throw httpError(404, 'Restaurant profile not found.');
        sendJson(res, 200, {
            profiles: [publicProfile(profile, { includeEmail: true, includeRoleConfig: true })],
        });
        return true;
    }

    // POST /api/profiles — create restaurant
    if (req.method === 'POST' && pathname === '/api/profiles') {
        const body = await readJsonBody(req);
        const email = normaliseEmail(body.email);
        const name = trimmed(body.name);

        if (!email) throw httpError(400, 'Email is required.');
        if (!validateEmail(email)) throw httpError(400, 'Enter a valid email address.');

        const db = await readAuthDb();
        const existing = db.profiles.find((p) => p.email === email);
        if (existing) {
            if (!existing.master_key_hash) {
                await issueResetCodeForProfile(db, existing);
                sendJson(res, 409, {
                    error: 'This restaurant profile already exists, but it does not have a master key yet. We sent a reset code to the restaurant email so you can set one now.',
                    action: 'master_key_setup_required',
                    email: existing.email,
                });
                return true;
            }
            throw httpError(400, `Email "${email}" is already linked to another restaurant.`);
        }

        if (!name) throw httpError(400, 'Restaurant name is required.');
        ensureMasterKeyLength(body.masterKey);
        ensurePinLength('Admin', body.adminPin);
        ensurePinLength('Waiter', body.waiterPin);

        const timestamp = nowIso();
        const profile = normalizeAuthProfile({
            id: randomUUID(),
            name,
            email,
            address: trimmed(body.address),
            phone: trimmed(body.phone),
            master_key_hash: await hashPassword(body.masterKey),
            admin_pin_hash: await hashPassword(body.adminPin),
            waiter_pin_hash: await hashPassword(body.waiterPin),
            admin_pin_enabled: asBoolean(body.adminPinEnabled, true),
            waiter_pin_enabled: asBoolean(body.waiterPinEnabled, true),
            reset_code_hash: null,
            reset_code_expires_at: null,
            created_at: timestamp,
            updated_at: timestamp,
        });

        db.profiles.push(profile);
        await writeAuthDb(db);
        await withAppMutation(async () => {
            const appDb = await readAppDb();
            ensureRestaurantData(appDb, profile);
            await writeAppDb(appDb);
        });

        // Fire-and-forget the welcome email in the background (don't block the request if it fails)
        sendAccountCreationEmail({
            to: email,
            restaurantName: name,
            masterKey: body.masterKey,
            adminPin: body.adminPin,
            waiterPin: body.waiterPin,
        }).catch((err) => console.error('[email] Failed to send welcome email:', err));

        sendJson(res, 201, { profile: publicProfile(profile, { includeEmail: true, includeRoleConfig: true }) });
        return true;
    }

    // PATCH /api/profiles/:id
    if (req.method === 'PATCH' && pathname.startsWith('/api/profiles/')) {
        const session = requireAdmin(req);
        const profileId = pathname.split('/').pop();
        if (profileId !== session.restaurantId) {
            throw httpError(403, 'You can only update your own restaurant profile.');
        }
        const body = await readJsonBody(req);
        const db = await readAuthDb();
        const profile = db.profiles.find((e) => e.id === profileId);
        if (!profile) throw httpError(404, 'Restaurant profile not found.');

        const nextName = body.name == null ? profile.name : trimmed(body.name);
        const nextEmail = body.email == null ? profile.email : normaliseEmail(body.email);

        if (!nextName) throw httpError(400, 'Restaurant name is required.');
        if (!nextEmail) throw httpError(400, 'Email is required.');
        if (!validateEmail(nextEmail)) throw httpError(400, 'Enter a valid email address.');
        if (db.profiles.some((e) => e.id !== profileId && e.email === nextEmail)) {
            throw httpError(400, `Email "${nextEmail}" is already linked to another restaurant.`);
        }

        profile.name = nextName;
        profile.email = nextEmail;
        profile.address = body.address == null ? profile.address : trimmed(body.address);
        profile.phone = body.phone == null ? profile.phone : trimmed(body.phone);
        profile.admin_pin_enabled = body.adminPinEnabled == null ? profile.admin_pin_enabled : asBoolean(body.adminPinEnabled, true);
        profile.waiter_pin_enabled = body.waiterPinEnabled == null ? profile.waiter_pin_enabled : asBoolean(body.waiterPinEnabled, true);
        profile.updated_at = nowIso();

        if (body.masterKey) { ensureMasterKeyLength(body.masterKey); profile.master_key_hash = await hashPassword(body.masterKey); }
        if (body.adminPin) { ensurePinLength('Admin', body.adminPin); profile.admin_pin_hash = await hashPassword(body.adminPin); }
        if (body.waiterPin) { ensurePinLength('Waiter', body.waiterPin); profile.waiter_pin_hash = await hashPassword(body.waiterPin); }

        await writeAuthDb(db);
        await withAppMutation(async () => {
            const appDb = await readAppDb();
            const { changed } = ensureRestaurantData(appDb, profile);
            if (changed) await writeAppDb(appDb);
        });

        sendJson(res, 200, { profile: publicProfile(profile, { includeEmail: true, includeRoleConfig: true }) });
        return true;
    }

    // DELETE /api/profiles/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/profiles/')) {
        const session = requireAdmin(req);
        const profileId = pathname.split('/').pop();
        if (profileId !== session.restaurantId) {
            throw httpError(403, 'You can only delete your own restaurant profile.');
        }
        const db = await readAuthDb();
        const next = db.profiles.filter((e) => e.id !== profileId);
        if (next.length === db.profiles.length) throw httpError(404, 'Restaurant profile not found.');

        db.profiles = next;
        await writeAuthDb(db);
        await withAppMutation(async () => {
            const appDb = await readAppDb();
            delete appDb.restaurants[profileId];
            await writeAppDb(appDb);
        });

        sendJson(res, 200, { ok: true });
        return true;
    }

    return false;
};
