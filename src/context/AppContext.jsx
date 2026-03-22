/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
    addAuditEvent,
    addOrder,
    deleteOrder,
    getBusinessDate,
    getOrderBusinessDate,
    getRestaurantData,
    saveSettings,
    updateOrder,
} from '../utils/storage.js';
import { getEditingSettingsDefaults, normalizeEditingSettings } from '../utils/editingMode.js';

const AppContext = createContext(null);

const emptySettings = {
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

export const AppProvider = ({ children }) => {
    const { restaurantId, role } = useAuth();

    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [settings, setSettings] = useState(emptySettings);
    const [auditLog, setAuditLog] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialised, setInitialised] = useState(false);
    const [error, setError] = useState('');

    const currentRole = role ?? null;
    const isAdmin = currentRole === 'admin';
    const editingModeEnabled = isAdmin && Boolean(settings?.editing_mode_enabled);

    const refresh = useCallback(async ({ silent = false } = {}) => {
        if (!restaurantId) return null;

        if (!silent) {
            setLoading(true);
        }

        try {
            const payload = await getRestaurantData();
            setCategories(payload.categories);
            setMenuItems(payload.menuItems);
            setOrders(payload.orders);
            setSettings({
                ...emptySettings,
                ...payload.settings,
                ...normalizeEditingSettings(payload.settings),
            });
            setAuditLog(payload.auditLog);
            setError('');
            setInitialised(true);
            return payload;
        } catch (err) {
            setError(err.message ?? 'Unable to load restaurant data.');
            throw err;
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [restaurantId]);

    useEffect(() => {
        let active = true;

        if (!restaurantId) {
            setCategories([]);
            setMenuItems([]);
            setOrders([]);
            setSettings(emptySettings);
            setAuditLog([]);
            setLoading(false);
            setInitialised(false);
            setError('');
            return undefined;
        }

        setInitialised(false);
        refresh().catch(() => {
            if (!active) return;
        });

        const pollId = window.setInterval(() => {
            if (document.hidden) return;
            refresh({ silent: true }).catch(() => {});
        }, 5000);

        const handleFocus = () => {
            refresh({ silent: true }).catch(() => {});
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);

        return () => {
            active = false;
            window.clearInterval(pollId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleFocus);
        };
    }, [restaurantId, refresh]);

    const appendAuditEvent = useCallback(async (event) => {
        if (!restaurantId) return null;

        try {
            const nextEvent = await addAuditEvent(event);
            setAuditLog((prev) => [...prev, nextEvent]);
            return nextEvent;
        } catch {
            return null;
        }
    }, [restaurantId]);

    const updateSettings = useCallback(async (data) => {
        if (!restaurantId) return null;

        const nextSettings = await saveSettings({
            ...settings,
            ...data,
        });

        setSettings({
            ...emptySettings,
            ...nextSettings,
            ...normalizeEditingSettings(nextSettings),
        });
        return nextSettings;
    }, [restaurantId, settings]);

    const createOrder = useCallback(async (orderData) => {
        if (!restaurantId) return null;

        const order = await addOrder({
            ...orderData,
            business_date: getBusinessDate(),
        });

        setOrders((prev) => [...prev, order]);
        await appendAuditEvent({
            order_id: order.id,
            event_type: 'order_created',
            details: { ticket_number: order.ticket_number },
        });
        await refresh({ silent: true }).catch(() => {});
        return order;
    }, [appendAuditEvent, refresh, restaurantId]);

    const advanceOrderStatus = useCallback(async (orderId) => {
        if (!restaurantId) return null;

        const order = orders.find((entry) => entry.id === orderId);
        if (!order) return null;

        const flow = { new: 'cooking', cooking: 'ready', ready: 'delivered' };
        const nextStatus = flow[order.status];
        if (!nextStatus) return null;

        const timestamp = new Date().toISOString();
        const patch = { status: nextStatus };
        if (nextStatus === 'cooking') patch.cooking_started_at = timestamp;
        if (nextStatus === 'ready') patch.cooking_finished_at = timestamp;
        if (nextStatus === 'delivered') patch.delivered_at = timestamp;

        const updated = await updateOrder(orderId, patch);
        setOrders((prev) => prev.map((entry) => (entry.id === orderId ? updated : entry)));
        await appendAuditEvent({
            order_id: orderId,
            event_type: 'status_changed',
            details: { from: order.status, to: nextStatus },
        });
        await refresh({ silent: true }).catch(() => {});
        return updated;
    }, [appendAuditEvent, orders, refresh, restaurantId]);

    const cancelOrder = useCallback(async (orderId, reason = '') => {
        if (!restaurantId) return null;

        const updated = await updateOrder(orderId, { status: 'cancelled' });
        setOrders((prev) => prev.map((entry) => (entry.id === orderId ? updated : entry)));
        await appendAuditEvent({
            order_id: orderId,
            event_type: 'order_cancelled',
            details: { reason },
        });
        await refresh({ silent: true }).catch(() => {});
        return updated;
    }, [appendAuditEvent, refresh, restaurantId]);

    const editOrder = useCallback(async (orderId, data, auditDetails = {}) => {
        if (!restaurantId) return null;

        const updated = await updateOrder(orderId, data);
        setOrders((prev) => prev.map((entry) => (entry.id === orderId ? updated : entry)));
        await appendAuditEvent({
            order_id: orderId,
            event_type: 'order_edited',
            details: auditDetails,
        });
        await refresh({ silent: true }).catch(() => {});
        return updated;
    }, [appendAuditEvent, refresh, restaurantId]);

    const hardDeleteOrder = useCallback(async (orderId) => {
        if (!restaurantId) return null;

        const updated = await deleteOrder(orderId);
        setOrders((prev) => prev.map((entry) => (entry.id === orderId ? updated : entry)));
        await appendAuditEvent({
            order_id: orderId,
            event_type: 'order_deleted',
            details: {},
        });
        await refresh({ silent: true }).catch(() => {});
        return updated;
    }, [appendAuditEvent, refresh, restaurantId]);

    const todayBusinessDate = getBusinessDate();
    const todayOrders = useMemo(
        () => orders.filter((order) => getOrderBusinessDate(order) === todayBusinessDate),
        [orders, todayBusinessDate],
    );
    const activeOrders = useMemo(
        () => todayOrders.filter((order) => !order.deleted_at && order.status !== 'cancelled'),
        [todayOrders],
    );

    return (
        <AppContext.Provider value={{
            categories,
            menuItems,
            orders,
            todayOrders,
            activeOrders,
            settings,
            auditLog,
            loading: loading && !initialised,
            refreshing: loading && initialised,
            initialised,
            error,
            todayBusinessDate,
            currentRole,
            isAdmin,
            editingModeEnabled,
            refresh,
            updateSettings,
            createOrder,
            advanceOrderStatus,
            cancelOrder,
            editOrder,
            hardDeleteOrder,
        }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used inside AppProvider');
    return ctx;
};
