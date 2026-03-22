import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../config.mjs';
import { trimmed, normaliseEmail, nowIso, asNumber, asBoolean, asString } from '../utils.mjs';
import { isMySqlEnabled, withMySqlTransaction, ensureMySqlSchema, getMySqlPool } from './mysql.mjs';

const AUTH_DB_PATH = path.join(DATA_DIR, 'auth-db.json');

const defaultAuthDb = () => ({ profiles: [] });

const asIsoOrNull = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const rowToProfile = (row) => normalizeAuthProfile({
    id: row.id,
    name: row.name,
    email: row.email,
    address: row.address,
    phone: row.phone,
    master_key_hash: row.master_key_hash,
    admin_pin_hash: row.admin_pin_hash,
    waiter_pin_hash: row.waiter_pin_hash,
    admin_pin_enabled: row.admin_pin_enabled,
    waiter_pin_enabled: row.waiter_pin_enabled,
    reset_code_hash: row.reset_code_hash,
    reset_code_expires_at: asIsoOrNull(row.reset_code_expires_at),
    created_at: asIsoOrNull(row.created_at),
    updated_at: asIsoOrNull(row.updated_at),
});

export const normalizeAuthProfile = (profile) => ({
    id: profile.id,
    name: trimmed(profile.name),
    email: normaliseEmail(profile.email),
    address: trimmed(profile.address),
    phone: trimmed(profile.phone),
    master_key_hash:
        profile.master_key_hash || profile.master_password_hash || profile.admin_password_hash || null,
    admin_pin_hash: profile.admin_pin_hash || profile.admin_password_hash || null,
    waiter_pin_hash: profile.waiter_pin_hash || profile.waiter_password_hash || null,
    admin_pin_enabled: asBoolean(profile.admin_pin_enabled, true),
    waiter_pin_enabled: asBoolean(profile.waiter_pin_enabled, true),
    reset_code_hash: profile.reset_code_hash ?? null,
    reset_code_expires_at: profile.reset_code_expires_at ?? null,
    created_at: profile.created_at ?? nowIso(),
    updated_at: profile.updated_at ?? profile.created_at ?? nowIso(),
});

const readJsonFile = async (filePath, fallback) => {
    try {
        const raw = await readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return fallback();
        throw error;
    }
};

const writeJsonAtomic = async (filePath, data) => {
    const tmp = `${filePath}.tmp`;
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await rename(tmp, filePath);
};

export const readAuthDb = async () => {
    if (isMySqlEnabled()) {
        await ensureMySqlSchema();
        const [rows] = await getMySqlPool().query('SELECT * FROM auth_profiles ORDER BY created_at ASC');
        return {
            profiles: rows.map(rowToProfile),
        };
    }

    const parsed = await readJsonFile(AUTH_DB_PATH, defaultAuthDb);
    return {
        profiles: Array.isArray(parsed.profiles)
            ? parsed.profiles.filter((e) => e?.id).map(normalizeAuthProfile)
            : [],
    };
};

export const writeAuthDb = async (db) => {
    if (isMySqlEnabled()) {
        const profiles = db.profiles.map(normalizeAuthProfile);
        await withMySqlTransaction(async (connection) => {
            const [rows] = await connection.query('SELECT id FROM auth_profiles');
            const existingIds = new Set(rows.map((row) => row.id));
            const nextIds = new Set(profiles.map((profile) => profile.id));

            for (const existingId of existingIds) {
                if (!nextIds.has(existingId)) {
                    await connection.query('DELETE FROM auth_profiles WHERE id = ?', [existingId]);
                }
            }

            for (const profile of profiles) {
                await connection.query(
                    `
                        INSERT INTO auth_profiles (
                            id,
                            name,
                            email,
                            address,
                            phone,
                            master_key_hash,
                            admin_pin_hash,
                            waiter_pin_hash,
                            admin_pin_enabled,
                            waiter_pin_enabled,
                            reset_code_hash,
                            reset_code_expires_at,
                            created_at,
                            updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            name = VALUES(name),
                            email = VALUES(email),
                            address = VALUES(address),
                            phone = VALUES(phone),
                            master_key_hash = VALUES(master_key_hash),
                            admin_pin_hash = VALUES(admin_pin_hash),
                            waiter_pin_hash = VALUES(waiter_pin_hash),
                            admin_pin_enabled = VALUES(admin_pin_enabled),
                            waiter_pin_enabled = VALUES(waiter_pin_enabled),
                            reset_code_hash = VALUES(reset_code_hash),
                            reset_code_expires_at = VALUES(reset_code_expires_at),
                            created_at = VALUES(created_at),
                            updated_at = VALUES(updated_at)
                    `,
                    [
                        profile.id,
                        profile.name,
                        profile.email,
                        profile.address ?? '',
                        profile.phone ?? '',
                        profile.master_key_hash,
                        profile.admin_pin_hash,
                        profile.waiter_pin_hash,
                        profile.admin_pin_enabled ? 1 : 0,
                        profile.waiter_pin_enabled ? 1 : 0,
                        profile.reset_code_hash,
                        profile.reset_code_expires_at ? new Date(profile.reset_code_expires_at) : null,
                        profile.created_at ? new Date(profile.created_at) : new Date(nowIso()),
                        profile.updated_at ? new Date(profile.updated_at) : new Date(nowIso()),
                    ],
                );
            }
        });
        return;
    }

    await writeJsonAtomic(AUTH_DB_PATH, {
        profiles: db.profiles.map(normalizeAuthProfile),
    });
};
