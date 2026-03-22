import { randomUUID } from 'node:crypto';
import { httpError, sendJson, readJsonBody, trimmed, nullableTrimmed, asNumber, asBoolean, nowIso, isValidBusinessDate } from '../utils.mjs';
import { readAppDb, writeAppDb, withAppMutation, loadRestaurantContext, ensureRestaurantData } from '../db/app.mjs';
import { readAuthDb } from '../db/auth.mjs';
import { requireSession, requireAdmin } from '../middleware.mjs';
import { publicProfile } from './profiles.mjs';

const ADDRESS_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const addressSearchCache = new Map();
const dedupeSuggestions = (entries) => {
    const seen = new Set();
    return entries.filter((entry) => {
        const label = trimmed(entry?.label).toLowerCase();
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
    });
};

// ── Order helpers ─────────────────────────────────────────────────────────────

const businessDateFromDate = (date = new Date()) => {
    const next = new Date(date);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const d = String(next.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const ticketDateFromBusinessDate = (bd) => bd.replace(/-/g, '');

const normalizeOrderItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw httpError(400, 'Orders must include at least one item.');
    }
    return items.map((item) => {
        const quantity = Math.max(1, Math.round(asNumber(item.quantity, 1)));
        const basePrice = asNumber(item.unit_price_snapshot, asNumber(item.final_unit_price, 0));
        const finalUnitPrice = asNumber(item.final_unit_price, basePrice);
        return {
            id: trimmed(item.id) || randomUUID(),
            ...(item.order_id ? { order_id: trimmed(item.order_id) } : {}),
            menu_item_id: trimmed(item.menu_item_id) || null,
            item_number: trimmed(item.item_number),
            item_name_snapshot: trimmed(item.item_name_snapshot),
            unit_price_snapshot: basePrice,
            unit_price_override: item.unit_price_override == null ? null : asNumber(item.unit_price_override, finalUnitPrice),
            final_unit_price: finalUnitPrice,
            quantity,
            line_total: finalUnitPrice * quantity,
            item_note: trimmed(item.item_note),
            ...(item.price_changed_by ? { price_changed_by: trimmed(item.price_changed_by) } : {}),
            ...(item.price_changed_at ? { price_changed_at: item.price_changed_at } : {}),
            ...(item.price_change_reason ? { price_change_reason: trimmed(item.price_change_reason) } : {}),
        };
    });
};

const summarizeOrder = (items) => ({
    subtotal: items.reduce((s, i) => s + asNumber(i.line_total, 0), 0),
    totalArticles: items.reduce((s, i) => s + asNumber(i.quantity, 0), 0),
});

const EDITABLE_PAGE_IDS = ['dashboard', 'new-order', 'menu', 'reports', 'settings', 'restaurants'];
const DEFAULT_PAGE_LABELS = {
    dashboard: 'Dashboard',
    'new-order': 'New Order',
    menu: 'Menu Management',
    reports: 'Daily Reports',
    settings: 'Settings',
    restaurants: 'Restaurant Access',
};
const DEFAULT_PAGE_VISIBILITY = Object.fromEntries(EDITABLE_PAGE_IDS.map((id) => [id, true]));
const DASHBOARD_SECTION_IDS = ['search', 'filters', 'orders'];
const DEFAULT_UI_LABELS = {
    dashboard_title: 'Dashboard',
    dashboard_subtitle_prefix: 'Shared live queue for',
    dashboard_cta_label: 'New Order',
    dashboard_search_title: 'Search Orders',
    dashboard_filters_title: 'Order Filters',
    dashboard_orders_title: 'Today\'s Queue',
};

const normalizeStringRecord = (input, defaults) => Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
        const value = trimmed(input?.[key]);
        return [key, value || fallback];
    }),
);

const normalizeBooleanRecord = (input, defaults) => Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
        if (key === 'settings') return [key, true];
        if (typeof input?.[key] === 'boolean') return [key, input[key]];
        return [key, fallback];
    }),
);

const normalizeOrderedIds = (input, allowedIds) => {
    const seen = new Set();
    const allowed = new Set(allowedIds);
    const next = Array.isArray(input)
        ? input.filter((id) => allowed.has(id) && !seen.has(id) && seen.add(id))
        : [];

    allowedIds.forEach((id) => {
        if (!seen.has(id)) next.push(id);
    });

    return next;
};

const normalizeEditableSettings = (source = {}) => ({
    editing_mode_enabled: asBoolean(source.editing_mode_enabled, false),
    custom_page_labels: normalizeStringRecord(source.custom_page_labels, DEFAULT_PAGE_LABELS),
    page_visibility: normalizeBooleanRecord(source.page_visibility, DEFAULT_PAGE_VISIBILITY),
    page_order: normalizeOrderedIds(source.page_order, EDITABLE_PAGE_IDS),
    ui_labels: normalizeStringRecord(source.ui_labels, DEFAULT_UI_LABELS),
    dashboard_section_order: normalizeOrderedIds(source.dashboard_section_order, DASHBOARD_SECTION_IDS),
});

const normalizeOrderCreate = (body, restaurantData) => {
    const orderType = trimmed(body.order_type) === 'delivery' ? 'delivery' : 'takeaway';
    const items = normalizeOrderItems(body.items);
    const { subtotal, totalArticles } = summarizeOrder(items);
    const deliveryCharge = orderType === 'delivery' ? asNumber(body.delivery_charge, 0) : 0;
    const discountAmount = asNumber(body.discount_amount, 0);
    const orderedAt = body.ordered_at ? new Date(body.ordered_at).toISOString() : nowIso();
    const businessDate = isValidBusinessDate(body.business_date)
        ? body.business_date
        : businessDateFromDate(new Date(orderedAt));

    if (orderType === 'delivery') {
        if (!trimmed(body.phone)) throw httpError(400, 'Phone is required for delivery orders.');
        if (!trimmed(body.address)) throw httpError(400, 'Address is required for delivery orders.');
    }

    const ticketDate = ticketDateFromBusinessDate(businessDate);
    const nextCounter = asNumber(restaurantData.ticketCounter[businessDate], 0) + 1;
    restaurantData.ticketCounter[businessDate] = nextCounter;

    return {
        id: randomUUID(),
        ticket_number: `${ticketDate}-${String(nextCounter).padStart(3, '0')}`,
        status: 'new',
        order_type: orderType,
        business_date: businessDate,
        customer_name: nullableTrimmed(body.customer_name),
        phone: nullableTrimmed(body.phone),
        address: nullableTrimmed(body.address),
        delivery_note: nullableTrimmed(body.delivery_note),
        delivery_charge: deliveryCharge,
        discount_amount: discountAmount,
        subtotal_amount: subtotal,
        total_amount: Math.max(0, subtotal + deliveryCharge - discountAmount),
        total_articles: totalArticles,
        items: items.map((i) => ({ ...i })),
        ordered_at: orderedAt,
        cooking_started_at: null,
        cooking_finished_at: null,
        delivered_at: null,
        deleted_at: null,
        deleted_by: null,
        created_at: nowIso(),
        updated_at: nowIso(),
    };
};

const normalizeOrderUpdate = (current, body) => {
    const nextItems = body.items ? normalizeOrderItems(body.items) : current.items;
    const { subtotal, totalArticles } = summarizeOrder(nextItems);
    const nextType = body.order_type
        ? (trimmed(body.order_type) === 'delivery' ? 'delivery' : 'takeaway')
        : current.order_type;
    const nextDelivery = nextType === 'delivery' ? asNumber(body.delivery_charge ?? current.delivery_charge, 0) : 0;
    const nextDiscount = asNumber(body.discount_amount ?? current.discount_amount, 0);

    return {
        ...current,
        order_type: nextType,
        status: body.status ? trimmed(body.status) : current.status,
        customer_name: body.customer_name !== undefined ? nullableTrimmed(body.customer_name) : current.customer_name,
        phone: body.phone !== undefined ? nullableTrimmed(body.phone) : current.phone,
        address: body.address !== undefined ? nullableTrimmed(body.address) : current.address,
        delivery_note: body.delivery_note !== undefined ? nullableTrimmed(body.delivery_note) : current.delivery_note,
        delivery_charge: nextDelivery,
        discount_amount: nextDiscount,
        subtotal_amount: subtotal,
        total_amount: Math.max(0, subtotal + nextDelivery - nextDiscount),
        total_articles: totalArticles,
        items: nextItems.map((i) => ({ ...i })),
        cooking_started_at: body.cooking_started_at !== undefined ? body.cooking_started_at : current.cooking_started_at,
        cooking_finished_at: body.cooking_finished_at !== undefined ? body.cooking_finished_at : current.cooking_finished_at,
        delivered_at: body.delivered_at !== undefined ? body.delivered_at : current.delivered_at,
        deleted_at: body.deleted_at !== undefined ? body.deleted_at : current.deleted_at,
        deleted_by: body.deleted_by !== undefined ? body.deleted_by : current.deleted_by,
        updated_at: nowIso(),
    };
};

// ── Settings/category/menu-item normalizers ───────────────────────────────────

const normalizeSettingsPayload = (body, current) => {
    const location_city = trimmed(body.location_city ?? current.location_city);
    const location_postal_code = trimmed(body.location_postal_code ?? current.location_postal_code);
    const location_street = trimmed(body.location_street ?? current.location_street);
    const location_house_number = trimmed(body.location_house_number ?? current.location_house_number);
    const addressFromParts = formatStructuredAddress({
        city: location_city,
        postalCode: location_postal_code,
        street: location_street,
        houseNumber: location_house_number,
    });

    return {
        location_city,
        location_postal_code,
        location_street,
        location_house_number,
        restaurant_name: trimmed(body.restaurant_name ?? current.restaurant_name) || current.restaurant_name || 'My Restaurant',
        address: body.address !== undefined ? trimmed(body.address) : (trimmed(current.address) || addressFromParts),
        phone: trimmed(body.phone ?? current.phone),
        default_delivery_charge: asNumber(body.default_delivery_charge ?? current.default_delivery_charge, 2.5),
        ...normalizeEditableSettings({
            ...current,
            ...body,
        }),
    };
};

const formatStructuredAddress = ({ city = '', postalCode = '', street = '', houseNumber = '' }) => (
    [trimmed(city), trimmed(postalCode), trimmed(street), trimmed(houseNumber)]
        .filter(Boolean)
        .join(', ')
);

const buildAddressSearchQuery = ({ city = '', postalCode = '', street = '', houseNumber = '' }) => {
    const queryStreet = [trimmed(houseNumber), trimmed(street)].filter(Boolean).join(' ');
    return [queryStreet, trimmed(postalCode), trimmed(city)].filter(Boolean).join(', ');
};

const mapAddressSuggestion = (entry) => {
    const address = entry?.address ?? {};
    const city = trimmed(
        address.city ||
        address.town ||
        address.village ||
        address.hamlet ||
        address.municipality ||
        address.county,
    );
    const postalCode = trimmed(address.postcode);
    const street = trimmed(
        address.road ||
        address.pedestrian ||
        address.footway ||
        address.residential ||
        address.suburb ||
        address.neighbourhood,
    );
    const houseNumber = trimmed(address.house_number);
    const label = formatStructuredAddress({ city, postalCode, street, houseNumber }) || trimmed(entry.display_name);

    return label
        ? {
            label,
            city,
            postalCode,
            street,
            houseNumber,
            source: 'map',
        }
        : null;
};

const CITY_TYPES = new Set(['city', 'town', 'village', 'municipality']);

const mapCitySuggestion = (entry, query) => {
    const properties = entry?.properties ?? {};
    const city = trimmed(properties.name || properties.city);
    const country = trimmed(properties.country);
    const type = trimmed(properties.osm_value).toLowerCase();
    const normalizedQuery = trimmed(query).toLowerCase();

    if (!city) return null;
    if (country !== 'Deutschland') return null;
    if (!CITY_TYPES.has(type)) return null;
    if (!city.toLowerCase().startsWith(normalizedQuery)) return null;

    return {
        label: city,
        city,
        postalCode: trimmed(properties.postcode),
        source: 'map',
    };
};

const searchGermanCities = async (query) => {
    const cleanQuery = trimmed(query);
    if (cleanQuery.length < 2) return [];

    const cacheKey = `city:${cleanQuery.toLowerCase()}`;
    const cached = addressSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.results;
    }

    const requestUrl = new URL('https://photon.komoot.io/api/');
    requestUrl.searchParams.set('limit', '8');
    requestUrl.searchParams.set('lang', 'de');
    requestUrl.searchParams.set('q', cleanQuery);

    const response = await fetch(requestUrl, {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw httpError(502, 'City lookup is unavailable right now.');
    }

    const payload = await response.json().catch(() => ({}));
    const results = dedupeSuggestions(
        Array.isArray(payload?.features)
            ? payload.features.map((entry) => mapCitySuggestion(entry, cleanQuery)).filter(Boolean)
            : [],
    );

    addressSearchCache.set(cacheKey, {
        expiresAt: Date.now() + ADDRESS_SEARCH_CACHE_TTL_MS,
        results,
    });

    return results;
};

const searchAddresses = async ({ city = '', postalCode = '', street = '', houseNumber = '' }) => {
    const cleanQuery = {
        city: trimmed(city),
        postalCode: trimmed(postalCode),
        street: trimmed(street),
        houseNumber: trimmed(houseNumber),
    };
    const cacheKey = JSON.stringify(cleanQuery);
    const cached = addressSearchCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.results;
    }

    const queryStreet = [cleanQuery.houseNumber, cleanQuery.street].filter(Boolean).join(' ');
    const requestUrl = new URL('https://nominatim.openstreetmap.org/search');
    requestUrl.searchParams.set('format', 'jsonv2');
    requestUrl.searchParams.set('addressdetails', '1');
    requestUrl.searchParams.set('limit', '6');
    requestUrl.searchParams.set('countrycodes', 'de');

    if (cleanQuery.city) requestUrl.searchParams.set('city', cleanQuery.city);
    if (cleanQuery.postalCode) requestUrl.searchParams.set('postalcode', cleanQuery.postalCode);
    if (queryStreet) requestUrl.searchParams.set('street', queryStreet);

    const fallbackQuery = buildAddressSearchQuery(cleanQuery);
    if (!queryStreet || (!cleanQuery.city && !cleanQuery.postalCode)) {
        requestUrl.searchParams.set('q', fallbackQuery);
    }

    const response = await fetch(requestUrl, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'RestaurantPOV/1.0 (address lookup)',
        },
    });

    if (!response.ok) {
        throw httpError(502, 'Address lookup is unavailable right now.');
    }

    const payload = await response.json().catch(() => []);
    const results = dedupeSuggestions(
        Array.isArray(payload)
            ? payload.map(mapAddressSuggestion).filter(Boolean)
            : [],
    );

    addressSearchCache.set(cacheKey, {
        expiresAt: Date.now() + ADDRESS_SEARCH_CACHE_TTL_MS,
        results,
    });

    return results;
};

const normalizeCategoryPayload = (body, currentSortOrder = 0) => {
    const name = trimmed(body.name);
    if (!name) throw httpError(400, 'Category name is required.');
    return { name, sort_order: Math.max(0, Math.round(asNumber(body.sort_order, currentSortOrder))), is_active: asBoolean(body.is_active, true) };
};

const normalizeMenuItemPayload = (body) => {
    const itemNumber = trimmed(body.item_number);
    const name = trimmed(body.name);
    const categoryId = trimmed(body.category_id);
    const price = asNumber(body.price, Number.NaN);
    if (!itemNumber) throw httpError(400, 'Item number is required.');
    if (!name) throw httpError(400, 'Item name is required.');
    if (!categoryId) throw httpError(400, 'Category is required.');
    if (!Number.isFinite(price) || price < 0) throw httpError(400, 'Enter a valid item price.');
    return { item_number: itemNumber, name, category_id: categoryId, price, is_active: asBoolean(body.is_active, true), notes: trimmed(body.notes) };
};

const categoryKey = (value) => trimmed(value).toLowerCase();

const createImportedCategory = (name, sortOrder) => {
    const timestamp = nowIso();
    return {
        id: randomUUID(),
        name: trimmed(name),
        sort_order: sortOrder,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
    };
};

const createImportedMenuItem = (item, categoryId) => {
    const timestamp = nowIso();
    return {
        id: randomUUID(),
        item_number: item.item_number,
        name: item.name,
        category_id: categoryId,
        price: item.price,
        is_active: item.is_active,
        notes: item.notes,
        created_at: timestamp,
        updated_at: timestamp,
    };
};

const normalizeMenuImportPayload = (body) => {
    const replaceExisting = asBoolean(body.replaceExisting ?? body.replace_existing, false);
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) throw httpError(400, 'The import does not contain any menu rows.');

    const seenItemNumbers = new Set();
    const items = rawItems.map((rawItem, index) => {
        const rowNumber = index + 2;
        const categoryName = trimmed(rawItem.category_name ?? rawItem.category ?? rawItem.categoryName);
        const itemNumber = trimmed(rawItem.item_number ?? rawItem.itemNumber);
        const name = trimmed(rawItem.name ?? rawItem.item_name ?? rawItem.itemName);
        const price = asNumber(rawItem.price, Number.NaN);
        const notes = trimmed(rawItem.notes);
        const isActive = asBoolean(rawItem.is_active ?? rawItem.isActive, true);

        if (!categoryName) throw httpError(400, `Row ${rowNumber}: category is required.`);
        if (!itemNumber) throw httpError(400, `Row ${rowNumber}: item number is required.`);
        if (!name) throw httpError(400, `Row ${rowNumber}: item name is required.`);
        if (!Number.isFinite(price) || price < 0) throw httpError(400, `Row ${rowNumber}: enter a valid price.`);
        if (seenItemNumbers.has(itemNumber)) throw httpError(400, `Duplicate item number "${itemNumber}" found in the import.`);

        seenItemNumbers.add(itemNumber);
        return {
            category_name: categoryName,
            item_number: itemNumber,
            name,
            price,
            notes,
            is_active: isActive,
        };
    });

    return { items, replaceExisting };
};

// ── Bootstrap ────────────────────────────────────────────────────────────────

const sendBootstrap = async (res, restaurantId) => {
    const payload = await withAppMutation(async () => {
        const { appDb, profile, restaurantData, changed } = await loadRestaurantContext(restaurantId);
        if (changed) await writeAppDb(appDb);
        return {
            settings: restaurantData.settings,
            categories: restaurantData.categories,
            menuItems: restaurantData.menuItems,
            orders: restaurantData.orders,
            auditLog: restaurantData.auditLog,
            restaurant: publicProfile(profile, { includeEmail: true, includeRoleConfig: true }),
        };
    });
    sendJson(res, 200, payload);
};

// ── Main handler ─────────────────────────────────────────────────────────────

export const handleApp = async (req, res, pathname) => {
    // GET /api/health
    if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { ok: true });
        return true;
    }

    // GET /api/app/bootstrap
    if (req.method === 'GET' && pathname === '/api/app/bootstrap') {
        const session = requireSession(req);
        await sendBootstrap(res, session.restaurantId);
        return true;
    }

    // GET /api/app/city-search
    if (req.method === 'GET' && pathname === '/api/app/city-search') {
        requireSession(req);
        const query = trimmed(req.query?.q);

        if (query.length < 2) {
            sendJson(res, 200, { suggestions: [] });
            return true;
        }

        try {
            const suggestions = await searchGermanCities(query);
            sendJson(res, 200, { suggestions });
        } catch (error) {
            sendJson(res, 200, {
                suggestions: [],
                warning: error.message ?? 'City lookup is unavailable right now.',
            });
        }
        return true;
    }

    // GET /api/app/address-search
    if (req.method === 'GET' && pathname === '/api/app/address-search') {
        requireSession(req);

        const city = trimmed(req.query?.city);
        const postalCode = trimmed(req.query?.postalCode);
        const street = trimmed(req.query?.street);
        const houseNumber = trimmed(req.query?.houseNumber);

        if (!city || ![postalCode, street, houseNumber].some(Boolean)) {
            sendJson(res, 200, { suggestions: [] });
            return true;
        }

        try {
            const suggestions = await searchAddresses({ city, postalCode, street, houseNumber });
            sendJson(res, 200, { suggestions });
        } catch (error) {
            sendJson(res, 200, {
                suggestions: [],
                warning: error.message ?? 'Address lookup is unavailable right now.',
            });
        }
        return true;
    }

    // PATCH /api/app/settings
    if (req.method === 'PATCH' && pathname === '/api/app/settings') {
        const session = requireAdmin(req);
        const body = await readJsonBody(req);
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            restaurantData.settings = normalizeSettingsPayload(body, restaurantData.settings);
            await writeAppDb(appDb);
            return { settings: restaurantData.settings };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // POST /api/app/menu-import
    if (req.method === 'POST' && pathname === '/api/app/menu-import') {
        const session = requireAdmin(req);
        const body = await readJsonBody(req);
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const { items, replaceExisting } = normalizeMenuImportPayload(body);

            const categories = replaceExisting
                ? []
                : restaurantData.categories.map((entry) => ({ ...entry }));
            const menuItems = replaceExisting
                ? []
                : restaurantData.menuItems.map((entry) => ({ ...entry }));

            const categoryIdByKey = new Map(categories.map((entry) => [categoryKey(entry.name), entry.id]));
            let nextSortOrder = categories.reduce(
                (max, entry) => Math.max(max, asNumber(entry.sort_order, 0)),
                -1,
            ) + 1;
            let categoriesCreated = 0;

            items.forEach((item) => {
                const key = categoryKey(item.category_name);
                if (!categoryIdByKey.has(key)) {
                    const category = createImportedCategory(item.category_name, nextSortOrder);
                    nextSortOrder += 1;
                    categories.push(category);
                    categoryIdByKey.set(key, category.id);
                    categoriesCreated += 1;
                }
            });

            const menuItemByNumber = new Map(menuItems.map((entry) => [entry.item_number, entry]));
            let itemsCreated = 0;
            let itemsUpdated = 0;

            items.forEach((item) => {
                const categoryId = categoryIdByKey.get(categoryKey(item.category_name));
                const existingItem = replaceExisting ? null : menuItemByNumber.get(item.item_number);

                if (existingItem) {
                    Object.assign(existingItem, {
                        item_number: item.item_number,
                        name: item.name,
                        category_id: categoryId,
                        price: item.price,
                        is_active: item.is_active,
                        notes: item.notes,
                        updated_at: nowIso(),
                    });
                    itemsUpdated += 1;
                    return;
                }

                const menuItem = createImportedMenuItem(item, categoryId);
                menuItems.push(menuItem);
                menuItemByNumber.set(menuItem.item_number, menuItem);
                itemsCreated += 1;
            });

            restaurantData.categories = categories.sort((a, b) => asNumber(a.sort_order, 0) - asNumber(b.sort_order, 0));
            restaurantData.menuItems = menuItems;

            await writeAppDb(appDb);
            return {
                ok: true,
                replaceExisting,
                categoriesCreated,
                itemsCreated,
                itemsUpdated,
                totalCategories: restaurantData.categories.length,
                totalItems: restaurantData.menuItems.length,
            };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // POST /api/app/categories
    if (req.method === 'POST' && pathname === '/api/app/categories') {
        const session = requireAdmin(req);
        const body = await readJsonBody(req);
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const normalized = normalizeCategoryPayload(body, restaurantData.categories.length);
            const category = { id: randomUUID(), ...normalized, created_at: nowIso(), updated_at: nowIso() };
            restaurantData.categories.push(category);
            await writeAppDb(appDb);
            return { category };
        });
        sendJson(res, 201, payload);
        return true;
    }

    // PATCH /api/app/categories/:id
    if (req.method === 'PATCH' && pathname.startsWith('/api/app/categories/')) {
        const session = requireAdmin(req);
        const categoryId = pathname.split('/').pop();
        const body = await readJsonBody(req);
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const category = restaurantData.categories.find((e) => e.id === categoryId);
            if (!category) throw httpError(404, 'Category not found.');
            Object.assign(category, normalizeCategoryPayload(body, category.sort_order), { updated_at: nowIso() });
            await writeAppDb(appDb);
            return { category };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // DELETE /api/app/categories/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/app/categories/')) {
        const session = requireAdmin(req);
        const categoryId = pathname.split('/').pop();
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            if (!restaurantData.categories.find((e) => e.id === categoryId)) throw httpError(404, 'Category not found.');
            restaurantData.categories = restaurantData.categories.filter((e) => e.id !== categoryId);
            restaurantData.menuItems = restaurantData.menuItems.filter((e) => e.category_id !== categoryId);
            await writeAppDb(appDb);
            return { ok: true };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // POST /api/app/menu-items
    if (req.method === 'POST' && pathname === '/api/app/menu-items') {
        const session = requireAdmin(req);
        const body = await readJsonBody(req);
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const normalized = normalizeMenuItemPayload(body);
            if (!restaurantData.categories.some((e) => e.id === normalized.category_id)) throw httpError(400, 'Select a valid category.');
            if (restaurantData.menuItems.some((e) => e.item_number === normalized.item_number)) throw httpError(400, `Item # ${normalized.item_number} already exists.`);
            const menuItem = { id: randomUUID(), ...normalized, created_at: nowIso(), updated_at: nowIso() };
            restaurantData.menuItems.push(menuItem);
            await writeAppDb(appDb);
            return { menuItem };
        });
        sendJson(res, 201, payload);
        return true;
    }

    // PATCH /api/app/menu-items/:id
    if (req.method === 'PATCH' && pathname.startsWith('/api/app/menu-items/')) {
        const session = requireAdmin(req);
        const menuItemId = pathname.split('/').pop();
        const body = await readJsonBody(req);
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const menuItem = restaurantData.menuItems.find((e) => e.id === menuItemId);
            if (!menuItem) throw httpError(404, 'Menu item not found.');
            const normalized = normalizeMenuItemPayload(body);
            if (!restaurantData.categories.some((e) => e.id === normalized.category_id)) throw httpError(400, 'Select a valid category.');
            if (restaurantData.menuItems.some((e) => e.id !== menuItemId && e.item_number === normalized.item_number)) throw httpError(400, `Item # ${normalized.item_number} already exists.`);
            Object.assign(menuItem, normalized, { updated_at: nowIso() });
            await writeAppDb(appDb);
            return { menuItem };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // DELETE /api/app/menu-items/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/app/menu-items/')) {
        const session = requireAdmin(req);
        const menuItemId = pathname.split('/').pop();
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            if (!restaurantData.menuItems.find((e) => e.id === menuItemId)) throw httpError(404, 'Menu item not found.');
            restaurantData.menuItems = restaurantData.menuItems.filter((e) => e.id !== menuItemId);
            await writeAppDb(appDb);
            return { ok: true };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // POST /api/app/orders
    if (req.method === 'POST' && pathname === '/api/app/orders') {
        const session = requireSession(req);
        const body = await readJsonBody(req);
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const order = normalizeOrderCreate(body, restaurantData);
            restaurantData.orders.push(order);
            await writeAppDb(appDb);
            return { order };
        });
        sendJson(res, 201, payload);
        return true;
    }

    // GET /api/app/orders/:id
    if (req.method === 'GET' && pathname.startsWith('/api/app/orders/')) {
        const session = requireSession(req);
        const orderId = pathname.split('/').pop();
        const { restaurantData } = await loadRestaurantContext(session.restaurantId);
        const order = restaurantData.orders.find((e) => e.id === orderId);
        if (!order) throw httpError(404, 'Order not found.');
        sendJson(res, 200, { order });
        return true;
    }

    // PATCH /api/app/orders/:id
    if (req.method === 'PATCH' && pathname.startsWith('/api/app/orders/')) {
        const session = requireSession(req);
        const orderId = pathname.split('/').pop();
        const body = await readJsonBody(req);

        const isPrivilegedUpdate = (
            body.items !== undefined ||
            body.customer_name !== undefined ||
            body.phone !== undefined ||
            body.address !== undefined ||
            body.delivery_note !== undefined ||
            body.delivery_charge !== undefined ||
            body.discount_amount !== undefined ||
            body.status === 'cancelled'
        );
        if (isPrivilegedUpdate && session.role !== 'admin') {
            throw httpError(403, 'Admin access required for this order update.');
        }

        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const idx = restaurantData.orders.findIndex((e) => e.id === orderId);
            if (idx === -1) throw httpError(404, 'Order not found.');
            restaurantData.orders[idx] = normalizeOrderUpdate(restaurantData.orders[idx], body);
            await writeAppDb(appDb);
            return { order: restaurantData.orders[idx] };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // DELETE /api/app/orders/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/app/orders/')) {
        const session = requireAdmin(req);
        const orderId = pathname.split('/').pop();
        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const order = restaurantData.orders.find((e) => e.id === orderId);
            if (!order) throw httpError(404, 'Order not found.');
            order.status = 'cancelled';
            order.deleted_at = nowIso();
            order.deleted_by = session.role;
            order.updated_at = nowIso();
            await writeAppDb(appDb);
            return { order };
        });
        sendJson(res, 200, payload);
        return true;
    }

    // POST /api/app/audit
    if (req.method === 'POST' && pathname === '/api/app/audit') {
        const session = requireSession(req);
        const body = await readJsonBody(req);
        const eventType = trimmed(body.event_type);
        if (!eventType) throw httpError(400, 'Event type is required.');

        const payload = await withAppMutation(async () => {
            const { appDb, restaurantData } = await loadRestaurantContext(session.restaurantId);
            const event = {
                id: randomUUID(),
                order_id: body.order_id ? trimmed(body.order_id) : null,
                event_type: eventType,
                changed_by: session.role,
                changed_at: nowIso(),
                details: body.details && typeof body.details === 'object' ? body.details : {},
            };
            restaurantData.auditLog.push(event);
            await writeAppDb(appDb);
            return { event };
        });
        sendJson(res, 201, payload);
        return true;
    }

    return false;
};
