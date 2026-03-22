import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DATA_DIR } from '../config.mjs';
import { nowIso, asNumber, asBoolean, trimmed } from '../utils.mjs';
import { ensureMySqlSchema, getMySqlPool, isMySqlEnabled, withMySqlTransaction } from './mysql.mjs';

const APP_DB_PATH = path.join(DATA_DIR, 'app-db.json');

const defaultAppDb = () => ({ restaurants: {} });

const parseJsonSafely = (value, fallback) => {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const normalizeRestaurantStateRow = (row) => ({
    settings: parseJsonSafely(row.settings_json, {}),
    categories: parseJsonSafely(row.categories_json, []),
    menuItems: parseJsonSafely(row.menu_items_json, []),
    orders: parseJsonSafely(row.orders_json, []),
    auditLog: parseJsonSafely(row.audit_log_json, []),
    ticketCounter: parseJsonSafely(row.ticket_counter_json, {}),
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

export const readAppDb = async () => {
    if (isMySqlEnabled()) {
        await ensureMySqlSchema();
        const [rows] = await getMySqlPool().query('SELECT * FROM restaurant_state');
        const restaurants = {};
        for (const row of rows) {
            restaurants[row.restaurant_id] = normalizeRestaurantStateRow(row);
        }
        return { restaurants };
    }

    const parsed = await readJsonFile(APP_DB_PATH, defaultAppDb);
    return {
        restaurants:
            parsed && typeof parsed.restaurants === 'object' && parsed.restaurants !== null
                ? parsed.restaurants
                : {},
    };
};

export const writeAppDb = async (db) => {
    if (isMySqlEnabled()) {
        const restaurantEntries = Object.entries(db.restaurants ?? {});
        await withMySqlTransaction(async (connection) => {
            const [rows] = await connection.query('SELECT restaurant_id FROM restaurant_state');
            const existingIds = new Set(rows.map((row) => row.restaurant_id));
            const nextIds = new Set(restaurantEntries.map(([restaurantId]) => restaurantId));

            for (const existingId of existingIds) {
                if (!nextIds.has(existingId)) {
                    await connection.query('DELETE FROM restaurant_state WHERE restaurant_id = ?', [existingId]);
                }
            }

            for (const [restaurantId, state] of restaurantEntries) {
                await connection.query(
                    `
                        INSERT INTO restaurant_state (
                            restaurant_id,
                            settings_json,
                            categories_json,
                            menu_items_json,
                            orders_json,
                            audit_log_json,
                            ticket_counter_json,
                            updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            settings_json = VALUES(settings_json),
                            categories_json = VALUES(categories_json),
                            menu_items_json = VALUES(menu_items_json),
                            orders_json = VALUES(orders_json),
                            audit_log_json = VALUES(audit_log_json),
                            ticket_counter_json = VALUES(ticket_counter_json),
                            updated_at = VALUES(updated_at)
                    `,
                    [
                        restaurantId,
                        JSON.stringify(state.settings ?? {}),
                        JSON.stringify(state.categories ?? []),
                        JSON.stringify(state.menuItems ?? []),
                        JSON.stringify(state.orders ?? []),
                        JSON.stringify(state.auditLog ?? []),
                        JSON.stringify(state.ticketCounter ?? {}),
                        new Date(nowIso()),
                    ],
                );
            }
        });
        return;
    }

    await writeJsonAtomic(APP_DB_PATH, db);
};

// Mutation queue: serialises all concurrent writes to prevent race conditions.
let appMutationQueue = Promise.resolve();
export const withAppMutation = async (handler) => {
    const task = appMutationQueue.then(handler, handler);
    appMutationQueue = task.catch(() => {});
    return task;
};

// ── Seed helpers ─────────────────────────────────────────────────────────────

const createSeedCategory = (name, sortOrder) => {
    const timestamp = nowIso();
    return { id: randomUUID(), name, sort_order: sortOrder, is_active: true, created_at: timestamp, updated_at: timestamp };
};

const createSeedItem = ({ item_number, name, category_id, price }) => {
    const timestamp = nowIso();
    return { id: randomUUID(), item_number, name, category_id, price, is_active: true, notes: '', created_at: timestamp, updated_at: timestamp };
};

export const seedRestaurantData = (restaurantData) => {
    if (restaurantData.categories.length > 0 || restaurantData.menuItems.length > 0) return;

    const starters = createSeedCategory('Starters', 0);
    const mains = createSeedCategory('Main Course', 1);
    const drinks = createSeedCategory('Drinks', 2);
    const desserts = createSeedCategory('Desserts', 3);

    restaurantData.categories = [starters, mains, drinks, desserts];
    restaurantData.menuItems = [
        createSeedItem({ item_number: '11', name: 'Veg Momos', category_id: starters.id, price: 6.5 }),
        createSeedItem({ item_number: '12', name: 'Chicken Momos', category_id: starters.id, price: 7.5 }),
        createSeedItem({ item_number: '13', name: 'Prawn Crackers', category_id: starters.id, price: 5 }),
        createSeedItem({ item_number: '14', name: 'Spring Rolls (2)', category_id: starters.id, price: 5.5 }),
        createSeedItem({ item_number: '21', name: 'Chicken Curry', category_id: mains.id, price: 12.9 }),
        createSeedItem({ item_number: '22', name: 'Paneer Curry', category_id: mains.id, price: 11.9 }),
        createSeedItem({ item_number: '23', name: 'Lamb Rogan Josh', category_id: mains.id, price: 14.9 }),
        createSeedItem({ item_number: '24', name: 'Veg Biryani', category_id: mains.id, price: 11 }),
        createSeedItem({ item_number: '25', name: 'Chicken Tikka Masala', category_id: mains.id, price: 13.5 }),
        createSeedItem({ item_number: '26', name: 'Naan Bread', category_id: mains.id, price: 2.5 }),
        createSeedItem({ item_number: '27', name: 'Steamed Rice', category_id: mains.id, price: 2 }),
        createSeedItem({ item_number: '31', name: 'Mango Lassi', category_id: drinks.id, price: 3.5 }),
        createSeedItem({ item_number: '32', name: 'Mineral Water', category_id: drinks.id, price: 1.5 }),
        createSeedItem({ item_number: '33', name: 'Soft Drink', category_id: drinks.id, price: 2 }),
        createSeedItem({ item_number: '34', name: 'Masala Tea', category_id: drinks.id, price: 2.5 }),
        createSeedItem({ item_number: '41', name: 'Gulab Jamun', category_id: desserts.id, price: 4 }),
        createSeedItem({ item_number: '42', name: 'Mango Kulfi', category_id: desserts.id, price: 4.5 }),
    ];
};

const defaultSettings = (profile) => ({
    restaurant_name: profile?.name ?? 'My Restaurant',
    address: profile?.address ?? '',
    phone: profile?.phone ?? '',
    location_city: '',
    location_postal_code: '',
    location_street: '',
    location_house_number: '',
    default_delivery_charge: 2.5,
    editing_mode_enabled: false,
    custom_page_labels: {
        dashboard: 'Dashboard',
        'new-order': 'New Order',
        menu: 'Menu Management',
        reports: 'Daily Reports',
        settings: 'Settings',
        restaurants: 'Restaurant Access',
    },
    page_visibility: {
        dashboard: true,
        'new-order': true,
        menu: true,
        reports: true,
        settings: true,
        restaurants: true,
    },
    page_order: ['dashboard', 'new-order', 'menu', 'reports', 'settings', 'restaurants'],
    ui_labels: {
        dashboard_title: 'Dashboard',
        dashboard_subtitle_prefix: 'Shared live queue for',
        dashboard_cta_label: 'New Order',
        dashboard_search_title: 'Search Orders',
        dashboard_filters_title: 'Order Filters',
        dashboard_orders_title: 'Today\'s Queue',
    },
    dashboard_section_order: ['search', 'filters', 'orders'],
});

export const ensureRestaurantData = (appDb, profile) => {
    let changed = false;

    if (!appDb.restaurants[profile.id] || typeof appDb.restaurants[profile.id] !== 'object') {
        appDb.restaurants[profile.id] = {
            settings: defaultSettings(profile),
            categories: [],
            menuItems: [],
            orders: [],
            auditLog: [],
            ticketCounter: {},
        };
        changed = true;
    }

    const r = appDb.restaurants[profile.id];

    if (!r.settings || typeof r.settings !== 'object') {
        r.settings = defaultSettings(profile);
        changed = true;
    } else {
        const baseSettings = defaultSettings(profile);
        const merged = {
            ...baseSettings,
            ...r.settings,
            custom_page_labels: {
                ...baseSettings.custom_page_labels,
                ...(r.settings.custom_page_labels ?? {}),
            },
            page_visibility: {
                ...baseSettings.page_visibility,
                ...(r.settings.page_visibility ?? {}),
            },
            ui_labels: {
                ...baseSettings.ui_labels,
                ...(r.settings.ui_labels ?? {}),
            },
            page_order: Array.isArray(r.settings.page_order) ? r.settings.page_order : baseSettings.page_order,
            dashboard_section_order: Array.isArray(r.settings.dashboard_section_order)
                ? r.settings.dashboard_section_order
                : baseSettings.dashboard_section_order,
            default_delivery_charge: asNumber(r.settings.default_delivery_charge, 2.5),
        };
        if (JSON.stringify(r.settings) !== JSON.stringify(merged)) {
            r.settings = merged;
            changed = true;
        }
    }

    for (const key of ['categories', 'menuItems', 'orders', 'auditLog']) {
        if (!Array.isArray(r[key])) { r[key] = []; changed = true; }
    }
    if (!r.ticketCounter || typeof r.ticketCounter !== 'object') {
        r.ticketCounter = {};
        changed = true;
    }
    if (r.categories.length === 0 && r.menuItems.length === 0) {
        seedRestaurantData(r);
        changed = true;
    }

    return { restaurantData: r, changed };
};

export const loadRestaurantContext = async (restaurantId) => {
    const { readAuthDb } = await import('./auth.mjs');
    const { httpError } = await import('../utils.mjs');
    const authDb = await readAuthDb();
    const profile = authDb.profiles.find((e) => e.id === restaurantId);
    if (!profile) throw httpError(404, 'Restaurant profile not found.');

    const appDb = await readAppDb();
    const ensured = ensureRestaurantData(appDb, profile);
    return { authDb, appDb, profile, ...ensured };
};
