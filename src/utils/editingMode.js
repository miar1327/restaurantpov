const PAGE_DEFINITIONS = [
    { id: 'dashboard', to: '/', tone: 'dashboard', defaultLabel: 'Dashboard' },
    { id: 'new-order', to: '/new-order', tone: 'new-order', defaultLabel: 'New Order' },
    { id: 'menu', to: '/menu', tone: 'menu', defaultLabel: 'Menu Management' },
    { id: 'reports', to: '/reports', tone: 'reports', defaultLabel: 'Daily Reports' },
    { id: 'settings', to: '/settings', tone: 'settings', defaultLabel: 'Settings' },
    { id: 'restaurants', to: '/restaurants', tone: 'access', defaultLabel: 'Restaurant Access', adminOnly: true },
];

const PAGE_DEFINITION_BY_ID = Object.fromEntries(PAGE_DEFINITIONS.map((page) => [page.id, page]));

const DASHBOARD_SECTION_DEFINITIONS = [
    { id: 'search', defaultLabel: 'Search Orders' },
    { id: 'filters', defaultLabel: 'Order Filters' },
    { id: 'orders', defaultLabel: 'Today\'s Queue' },
];

const DASHBOARD_SECTION_BY_ID = Object.fromEntries(
    DASHBOARD_SECTION_DEFINITIONS.map((section) => [section.id, section]),
);

export const DEFAULT_PAGE_ORDER = PAGE_DEFINITIONS.map((page) => page.id);
export const DEFAULT_PAGE_LABELS = Object.fromEntries(
    PAGE_DEFINITIONS.map((page) => [page.id, page.defaultLabel]),
);
export const DEFAULT_PAGE_VISIBILITY = Object.fromEntries(
    PAGE_DEFINITIONS.map((page) => [page.id, true]),
);
export const DEFAULT_UI_LABELS = {
    dashboard_title: 'Dashboard',
    dashboard_subtitle_prefix: 'Shared live queue for',
    dashboard_cta_label: 'New Order',
    dashboard_search_title: 'Search Orders',
    dashboard_filters_title: 'Order Filters',
    dashboard_orders_title: 'Today\'s Queue',
};
export const DEFAULT_DASHBOARD_SECTION_ORDER = DASHBOARD_SECTION_DEFINITIONS.map((section) => section.id);

const clean = (value = '') => String(value ?? '').trim();

const normalizeStringRecord = (input, defaults) => Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
        const nextValue = clean(input?.[key]);
        return [key, nextValue || fallback];
    }),
);

const normalizeBooleanRecord = (input, defaults) => Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
        if (key === 'settings') return [key, true];
        if (typeof input?.[key] === 'boolean') return [key, input[key]];
        return [key, fallback];
    }),
);

const normalizeOrder = (input, defaults) => {
    const allowed = new Set(defaults);
    const seen = new Set();
    const next = Array.isArray(input)
        ? input.filter((id) => allowed.has(id) && !seen.has(id) && seen.add(id))
        : [];

    defaults.forEach((id) => {
        if (!seen.has(id)) next.push(id);
    });

    return next;
};

export const getEditingSettingsDefaults = () => ({
    editing_mode_enabled: false,
    custom_page_labels: { ...DEFAULT_PAGE_LABELS },
    page_visibility: { ...DEFAULT_PAGE_VISIBILITY },
    page_order: [...DEFAULT_PAGE_ORDER],
    ui_labels: { ...DEFAULT_UI_LABELS },
    dashboard_section_order: [...DEFAULT_DASHBOARD_SECTION_ORDER],
});

export const normalizeEditingSettings = (settings = {}) => ({
    ...getEditingSettingsDefaults(),
    editing_mode_enabled: Boolean(settings?.editing_mode_enabled),
    custom_page_labels: normalizeStringRecord(settings?.custom_page_labels, DEFAULT_PAGE_LABELS),
    page_visibility: normalizeBooleanRecord(settings?.page_visibility, DEFAULT_PAGE_VISIBILITY),
    page_order: normalizeOrder(settings?.page_order, DEFAULT_PAGE_ORDER),
    ui_labels: normalizeStringRecord(settings?.ui_labels, DEFAULT_UI_LABELS),
    dashboard_section_order: normalizeOrder(
        settings?.dashboard_section_order,
        DEFAULT_DASHBOARD_SECTION_ORDER,
    ),
});

export const getSidebarPages = (settings, isAdmin) => {
    const editable = normalizeEditingSettings(settings);
    const orderedPages = editable.page_order
        .map((pageId) => PAGE_DEFINITION_BY_ID[pageId])
        .filter(Boolean)
        .filter((page) => isAdmin || !page.adminOnly);

    const visiblePages = orderedPages.filter((page) => editable.page_visibility[page.id] !== false || page.id === 'settings');
    const hiddenPages = orderedPages.filter((page) => !visiblePages.includes(page));

    return { editable, visiblePages, hiddenPages };
};

export const getDashboardSections = (settings) => {
    const editable = normalizeEditingSettings(settings);
    return editable.dashboard_section_order
        .map((sectionId) => DASHBOARD_SECTION_BY_ID[sectionId])
        .filter(Boolean);
};

export const moveListItem = (items, sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return items;

    const nextItems = [...items];
    const sourceIndex = nextItems.indexOf(sourceId);
    const targetIndex = nextItems.indexOf(targetId);

    if (sourceIndex === -1 || targetIndex === -1) return items;

    const [movedId] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, movedId);
    return nextItems;
};

