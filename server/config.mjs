import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.resolve(
    process.env.RESTAURANTPOV_DATA_DIR || path.join(ROOT_DIR, 'data'),
);
export const DIST_DIR = path.join(ROOT_DIR, 'dist');
export const IS_PROD = process.argv.includes('--prod');

const INSECURE_DEFAULTS = new Set([
    '',
    'restaurantpov-dev-secret',
    'change-this-long-random-secret',
]);

const loadEnvFile = () => {
    const envPath = path.join(ROOT_DIR, '.env');
    if (!existsSync(envPath)) return;

    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        const eqIndex = trimmedLine.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmedLine.slice(0, eqIndex).trim();
        let value = trimmedLine.slice(eqIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
};

loadEnvFile();

export const PORT = Number(
    process.env.PORT || process.env.AUTH_SERVER_PORT || (IS_PROD ? 3000 : 8787),
);

export const MYSQL_HOST = process.env.MYSQL_HOST || process.env.DB_HOST || '';
export const MYSQL_PORT = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
export const MYSQL_USER = process.env.MYSQL_USER || process.env.DB_USER || '';
export const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
export const MYSQL_DATABASE = process.env.MYSQL_DATABASE || process.env.DB_NAME || '';
export const MYSQL_SSL = /^(1|true|yes)$/i.test(process.env.MYSQL_SSL || '');
export const USE_MYSQL = Boolean(MYSQL_HOST && MYSQL_USER && MYSQL_DATABASE);

const rawSecret = process.env.AUTH_SECRET || '';
if (IS_PROD && INSECURE_DEFAULTS.has(rawSecret)) {
    console.error(
        '\n[Restaurant POV] FATAL: AUTH_SECRET is missing or insecure.\n' +
        'Set a strong, random AUTH_SECRET in .env before running in production.\n' +
        'Example: AUTH_SECRET=your-64-char-random-string\n',
    );
    process.exit(1);
}

export const AUTH_SECRET = rawSecret || 'restaurantpov-dev-secret';
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const RESEND_FROM_EMAIL =
    process.env.RESEND_FROM_EMAIL || 'Restaurant POV <onboarding@resend.dev>';

export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ROLES = ['admin', 'waiter'];
