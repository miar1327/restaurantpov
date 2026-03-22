import mysql from 'mysql2/promise';
import {
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
    MYSQL_SSL,
    USE_MYSQL,
} from '../config.mjs';

let pool = null;
let schemaReady = null;

const createPool = () => mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    charset: 'utf8mb4',
    ...(MYSQL_SSL ? { ssl: {} } : {}),
});

export const isMySqlEnabled = () => USE_MYSQL;

export const getMySqlPool = () => {
    if (!USE_MYSQL) return null;
    if (!pool) {
        pool = createPool();
    }
    return pool;
};

const ensureSchemaInternal = async () => {
    const activePool = getMySqlPool();
    if (!activePool) return;

    await activePool.query(`
        CREATE TABLE IF NOT EXISTS auth_profiles (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(191) NOT NULL UNIQUE,
            address TEXT NOT NULL,
            phone VARCHAR(255) NOT NULL,
            master_key_hash TEXT NULL,
            admin_pin_hash TEXT NULL,
            waiter_pin_hash TEXT NULL,
            admin_pin_enabled TINYINT(1) NOT NULL DEFAULT 1,
            waiter_pin_enabled TINYINT(1) NOT NULL DEFAULT 1,
            reset_code_hash TEXT NULL,
            reset_code_expires_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await activePool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_state (
            restaurant_id VARCHAR(36) PRIMARY KEY,
            settings_json LONGTEXT NOT NULL,
            categories_json LONGTEXT NOT NULL,
            menu_items_json LONGTEXT NOT NULL,
            orders_json LONGTEXT NOT NULL,
            audit_log_json LONGTEXT NOT NULL,
            ticket_counter_json LONGTEXT NOT NULL,
            updated_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

export const ensureMySqlSchema = async () => {
    if (!USE_MYSQL) return;
    if (!schemaReady) {
        schemaReady = ensureSchemaInternal().catch((error) => {
            schemaReady = null;
            throw error;
        });
    }
    await schemaReady;
};

export const withMySqlTransaction = async (handler) => {
    const activePool = getMySqlPool();
    if (!activePool) {
        throw new Error('MySQL is not configured.');
    }

    await ensureMySqlSchema();
    const connection = await activePool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await handler(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
