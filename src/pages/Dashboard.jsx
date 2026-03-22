import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Pencil, PlusCircle, Search, X } from 'lucide-react';
import OrderCard from '../components/OrderCard';
import ConfirmDialog from '../components/ConfirmDialog';
import OrderEditModal from '../components/OrderEditModal';
import OrderDetailModal from '../components/OrderDetailModal';
import { useApp } from '../context/AppContext';
import { getDashboardSections, normalizeEditingSettings } from '../utils/editingMode.js';

const STATUS_TABS = ['all', 'new', 'cooking', 'ready', 'delivered', 'cancelled'];
const SECTION_LABEL_KEYS = {
    search: 'dashboard_search_title',
    filters: 'dashboard_filters_title',
    orders: 'dashboard_orders_title',
};

export default function Dashboard() {
    const {
        todayOrders,
        advanceOrderStatus,
        cancelOrder,
        hardDeleteOrder,
        isAdmin,
        loading,
        todayBusinessDate,
        settings,
        updateSettings,
        editingModeEnabled,
    } = useApp();
    const navigate = useNavigate();
    const editable = useMemo(() => normalizeEditingSettings(settings), [settings]);
    const sectionOrder = useMemo(() => getDashboardSections(settings), [settings]);
    const uiLabels = editable.ui_labels;

    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [editingOrder, setEditingOrder] = useState(null);
    const [detailOrder, setDetailOrder] = useState(null);
    const [headerEditorOpen, setHeaderEditorOpen] = useState(false);
    const [headerDraft, setHeaderDraft] = useState(uiLabels);

    useEffect(() => {
        setHeaderDraft(uiLabels);
    }, [uiLabels]);

    const allVisible = todayOrders.filter((order) => !order.deleted_at || (order.deleted_at && order.status === 'cancelled'));
    const displayOrders = allVisible
        .filter((order) => statusFilter === 'all' || order.status === statusFilter)
        .filter((order) => {
            if (!search) return true;
            const query = search.toLowerCase();
            return (
                order.ticket_number?.toLowerCase().includes(query) ||
                order.customer_name?.toLowerCase().includes(query) ||
                order.phone?.includes(query)
            );
        })
        .sort((left, right) => new Date(right.ordered_at) - new Date(left.ordered_at));

    const handleAdvance = useCallback(async (orderId) => {
        const updated = await advanceOrderStatus(orderId);
        if (!updated) return;

        setEditingOrder((prev) => (prev?.id === orderId ? updated : prev));
        setDetailOrder((prev) => (prev?.id === orderId ? updated : prev));
    }, [advanceOrderStatus]);

    const handleCancel = useCallback((order) => {
        setConfirmAction({
            type: 'cancel',
            title: 'Cancel Order',
            message: `Cancel order #${order.ticket_number}? This cannot be undone easily.`,
            onConfirm: async () => {
                await cancelOrder(order.id);
                setConfirmAction(null);
                setDetailOrder(null);
            },
        });
    }, [cancelOrder]);

    const handleDelete = useCallback((order) => {
        setConfirmAction({
            type: 'delete',
            title: 'Delete Order',
            message: `Permanently delete order #${order.ticket_number}? (soft-delete)`,
            onConfirm: async () => {
                await hardDeleteOrder(order.id);
                setConfirmAction(null);
                setDetailOrder(null);
            },
            danger: true,
        });
    }, [hardDeleteOrder]);

    const handleCardClick = useCallback((order, event) => {
        if (event.target.closest('button')) return;
        setDetailOrder(order);
    }, []);

    const countByStatus = (status) => (
        status === 'all'
            ? allVisible.length
            : allVisible.filter((order) => order.status === status).length
    );

    const saveHeaderLabels = async () => {
        await updateSettings({
            ui_labels: {
                ...uiLabels,
                dashboard_title: headerDraft.dashboard_title.trim() || uiLabels.dashboard_title,
                dashboard_subtitle_prefix: headerDraft.dashboard_subtitle_prefix.trim() || uiLabels.dashboard_subtitle_prefix,
                dashboard_cta_label: headerDraft.dashboard_cta_label.trim() || uiLabels.dashboard_cta_label,
            },
        });
        setHeaderEditorOpen(false);
    };

    const renameSection = async (sectionId) => {
        const labelKey = SECTION_LABEL_KEYS[sectionId];
        const currentLabel = uiLabels[labelKey];
        const nextLabel = window.prompt(`Rename "${currentLabel}"`, currentLabel);
        if (nextLabel == null) return;

        const trimmedLabel = nextLabel.trim();
        if (!trimmedLabel || trimmedLabel === currentLabel) return;

        await updateSettings({
            ui_labels: {
                ...uiLabels,
                [labelKey]: trimmedLabel,
            },
        });
    };

    const moveSection = async (sectionId, direction) => {
        const currentOrder = [...editable.dashboard_section_order];
        const index = currentOrder.indexOf(sectionId);
        const targetIndex = index + direction;
        if (index === -1 || targetIndex < 0 || targetIndex >= currentOrder.length) return;

        const nextOrder = [...currentOrder];
        const [moved] = nextOrder.splice(index, 1);
        nextOrder.splice(targetIndex, 0, moved);
        await updateSettings({ dashboard_section_order: nextOrder });
    };

    const renderSectionBody = (sectionId) => {
        if (sectionId === 'search') {
            return (
                <div className="search-bar">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search by ticket # or customer name…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                        <button className="clear-search" onClick={() => setSearch('')} type="button">
                            <X size={14} />
                        </button>
                    )}
                </div>
            );
        }

        if (sectionId === 'filters') {
            return (
                <div className="status-tabs">
                    {STATUS_TABS.map((status) => (
                        <button
                            key={status}
                            className={`status-tab ${statusFilter === status ? 'active' : ''} tab-${status}`}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                        >
                            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                            <span className="tab-count">{countByStatus(status)}</span>
                        </button>
                    ))}
                </div>
            );
        }

        return displayOrders.length === 0 ? (
            <div className="empty-state">
                <p>No orders for today yet.</p>
                <button className="btn btn-primary" onClick={() => navigate('/new-order')} type="button">
                    <PlusCircle size={16} /> Create First Order
                </button>
            </div>
        ) : (
            <div className="order-grid">
                {displayOrders.map((order) => (
                    <div
                        key={order.id}
                        className="order-card-wrapper"
                        onClick={(event) => handleCardClick(order, event)}
                    >
                        <OrderCard
                            order={order}
                            onAdvance={handleAdvance}
                            onEdit={(nextOrder) => { setEditingOrder(nextOrder); setDetailOrder(null); }}
                            onCancel={handleCancel}
                            onDelete={handleDelete}
                        />
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="page">
                <p className="muted">Loading today's orders...</p>
            </div>
        );
    }

    return (
        <div className="page dashboard-page">
            <div className="page-header editable-page-header">
                <div>
                    <h1 className="page-title">{uiLabels.dashboard_title}</h1>
                    <p className="page-subtitle">
                        {uiLabels.dashboard_subtitle_prefix} {todayBusinessDate} - click any card to view details
                    </p>
                </div>
                <div className="dashboard-header-actions">
                    {editingModeEnabled && (
                        <button
                            className="editor-corner-btn"
                            type="button"
                            onClick={() => setHeaderEditorOpen((current) => !current)}
                        >
                            <Pencil size={14} />
                            <span>Edit header</span>
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => navigate('/new-order')} type="button">
                        <PlusCircle size={18} /> {uiLabels.dashboard_cta_label}
                    </button>
                </div>
            </div>

            {editingModeEnabled && headerEditorOpen && (
                <div className="dashboard-editor-panel">
                    <div className="form-group">
                        <label>Dashboard Title</label>
                        <input
                            value={headerDraft.dashboard_title ?? ''}
                            onChange={(event) => setHeaderDraft((current) => ({
                                ...current,
                                dashboard_title: event.target.value,
                            }))}
                        />
                    </div>
                    <div className="form-group">
                        <label>Subtitle Prefix</label>
                        <input
                            value={headerDraft.dashboard_subtitle_prefix ?? ''}
                            onChange={(event) => setHeaderDraft((current) => ({
                                ...current,
                                dashboard_subtitle_prefix: event.target.value,
                            }))}
                        />
                    </div>
                    <div className="form-group">
                        <label>Primary Button Label</label>
                        <input
                            value={headerDraft.dashboard_cta_label ?? ''}
                            onChange={(event) => setHeaderDraft((current) => ({
                                ...current,
                                dashboard_cta_label: event.target.value,
                            }))}
                        />
                    </div>
                    <div className="dashboard-editor-actions">
                        <button className="btn btn-primary" type="button" onClick={saveHeaderLabels}>
                            Save Header
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => setHeaderEditorOpen(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {sectionOrder.map((section, index) => (
                <section key={section.id} className="dashboard-section-card">
                    <div className="dashboard-section-header">
                        <div className="dashboard-section-title">
                            {uiLabels[SECTION_LABEL_KEYS[section.id]] || section.defaultLabel}
                        </div>
                        {editingModeEnabled && isAdmin && (
                            <div className="dashboard-section-tools">
                                <button
                                    className="editor-corner-btn"
                                    type="button"
                                    onClick={() => renameSection(section.id)}
                                >
                                    <Pencil size={13} />
                                </button>
                                <button
                                    className="editor-corner-btn"
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => moveSection(section.id, -1)}
                                >
                                    <ArrowUp size={13} />
                                </button>
                                <button
                                    className="editor-corner-btn"
                                    type="button"
                                    disabled={index === sectionOrder.length - 1}
                                    onClick={() => moveSection(section.id, 1)}
                                >
                                    <ArrowDown size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                    {renderSectionBody(section.id)}
                </section>
            ))}

            {detailOrder && !editingOrder && (
                <OrderDetailModal
                    order={detailOrder}
                    onClose={() => setDetailOrder(null)}
                    onAdvance={(orderId) => {
                        handleAdvance(orderId);
                    }}
                />
            )}

            {editingOrder && isAdmin && (
                <OrderEditModal
                    order={editingOrder}
                    onClose={() => setEditingOrder(null)}
                />
            )}

            {confirmAction && (
                <ConfirmDialog
                    title={confirmAction.title}
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                    danger={confirmAction.danger}
                    confirmLabel={confirmAction.type === 'delete' ? 'Delete' : 'Cancel Order'}
                />
            )}
        </div>
    );
}
