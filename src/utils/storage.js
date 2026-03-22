import { apiRequest } from './api.js';
import { getEditingSettingsDefaults, normalizeEditingSettings } from './editingMode.js';

export const getBusinessDate = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getOrderBusinessDate = (order) => (
    order?.business_date || getBusinessDate(order?.ordered_at || new Date())
);

const asNumber = (value, fallback = 0) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
};

const DEFAULT_SETTINGS = {
    restaurant_name: 'My Restaurant',
    address: '',
    phone: '',
    location_city: '',
    location_postal_code: '',
    location_street: '',
    location_house_number: '',
    default_delivery_charge: 2.5,
    ...getEditingSettingsDefaults(),
};

export const getRestaurantData = async () => {
    const payload = await apiRequest('/api/app/bootstrap');
    return {
        settings: {
            ...DEFAULT_SETTINGS,
            ...(payload.settings ?? {}),
            ...normalizeEditingSettings(payload.settings ?? {}),
            default_delivery_charge: asNumber(
                payload?.settings?.default_delivery_charge,
                DEFAULT_SETTINGS.default_delivery_charge,
            ),
        },
        categories: Array.isArray(payload.categories) ? payload.categories : [],
        menuItems: Array.isArray(payload.menuItems) ? payload.menuItems : [],
        orders: Array.isArray(payload.orders) ? payload.orders : [],
        auditLog: Array.isArray(payload.auditLog) ? payload.auditLog : [],
        restaurant: payload.restaurant ?? null,
    };
};

export const getSettings = async () => (await getRestaurantData()).settings;
export const getCategories = async () => (await getRestaurantData()).categories;
export const getMenuItems = async () => (await getRestaurantData()).menuItems;
export const getOrders = async () => (await getRestaurantData()).orders;

export const saveSettings = async (data) => {
    const payload = await apiRequest('/api/app/settings', { method: 'PATCH', body: data });
    return payload.settings;
};

export const addCategory = async (data) => {
    const payload = await apiRequest('/api/app/categories', { method: 'POST', body: data });
    return payload.category;
};

export const updateCategory = async (categoryId, data) => {
    const payload = await apiRequest(`/api/app/categories/${categoryId}`, { method: 'PATCH', body: data });
    return payload.category;
};

export const deleteCategory = async (categoryId) => {
    await apiRequest(`/api/app/categories/${categoryId}`, { method: 'DELETE' });
};

export const addMenuItem = async (data) => {
    const payload = await apiRequest('/api/app/menu-items', { method: 'POST', body: data });
    return payload.menuItem;
};

export const updateMenuItem = async (itemId, data) => {
    const payload = await apiRequest(`/api/app/menu-items/${itemId}`, { method: 'PATCH', body: data });
    return payload.menuItem;
};

export const deleteMenuItem = async (itemId) => {
    await apiRequest(`/api/app/menu-items/${itemId}`, { method: 'DELETE' });
};

export const importMenu = async (data) => {
    const payload = await apiRequest('/api/app/menu-import', { method: 'POST', body: data });
    return payload;
};

export const addOrder = async (data) => {
    const payload = await apiRequest('/api/app/orders', {
        method: 'POST',
        body: { ...data, business_date: data.business_date || getBusinessDate() },
    });
    return payload.order;
};

export const updateOrder = async (orderId, data) => {
    const payload = await apiRequest(`/api/app/orders/${orderId}`, { method: 'PATCH', body: data });
    return payload.order;
};

export const deleteOrder = async (orderId) => {
    const payload = await apiRequest(`/api/app/orders/${orderId}`, { method: 'DELETE' });
    return payload.order;
};

export const getOrderById = async (orderId) => {
    const payload = await apiRequest(`/api/app/orders/${orderId}`);
    return payload.order;
};

export const lookupAddressSuggestions = async (query, { signal } = {}) => {
    const params = new URLSearchParams();

    Object.entries(query ?? {}).forEach(([key, value]) => {
        const nextValue = String(value ?? '').trim();
        if (nextValue) {
            params.set(key, nextValue);
        }
    });

    const payload = await apiRequest(`/api/app/address-search?${params.toString()}`, {
        signal,
    });
    return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
};

export const lookupGermanCities = async (query, { signal } = {}) => {
    const q = String(query ?? '').trim();
    if (!q) return [];

    const payload = await apiRequest(`/api/app/city-search?q=${encodeURIComponent(q)}`, {
        signal,
    });
    return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
};

export const addAuditEvent = async (event) => {
    const payload = await apiRequest('/api/app/audit', { method: 'POST', body: event });
    return payload.event;
};

export const seedDemoData = async () => getRestaurantData();
