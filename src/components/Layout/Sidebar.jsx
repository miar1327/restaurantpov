import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    BarChart2,
    BookOpen,
    Building2,
    ChefHat,
    Eye,
    EyeOff,
    GripVertical,
    LayoutDashboard,
    LogOut,
    Pencil,
    PlusCircle,
    RefreshCw,
    Settings,
    ShieldCheck,
    User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { getSidebarPages, moveListItem } from '../../utils/editingMode.js';

const ICON_BY_PAGE_ID = {
    dashboard: LayoutDashboard,
    'new-order': PlusCircle,
    menu: BookOpen,
    reports: BarChart2,
    settings: Settings,
    restaurants: Building2,
};

export default function Sidebar() {
    const { profile, role, isAdmin, logout, switchRole } = useAuth();
    const { settings, updateSettings, editingModeEnabled } = useApp();
    const { editable, visiblePages, hiddenPages } = useMemo(
        () => getSidebarPages(settings, isAdmin),
        [isAdmin, settings],
    );

    const [draggedPageId, setDraggedPageId] = useState(null);
    const [pageOrderIds, setPageOrderIds] = useState(editable.page_order);
    const [busyPageId, setBusyPageId] = useState('');
    const [reorderingPages, setReorderingPages] = useState(false);
    const dropHandledRef = useRef(false);

    useEffect(() => {
        if (draggedPageId || reorderingPages) return;
        setPageOrderIds(editable.page_order);
    }, [draggedPageId, editable.page_order, reorderingPages]);

    const visiblePageMap = new Map(visiblePages.map((page) => [page.id, page]));
    const orderedVisiblePages = pageOrderIds
        .map((pageId) => visiblePageMap.get(pageId))
        .filter(Boolean);

    const persistPageOrder = async (nextIds) => {
        setReorderingPages(true);
        try {
            await updateSettings({ page_order: nextIds });
        } finally {
            setDraggedPageId(null);
            setReorderingPages(false);
        }
    };

    const handleDragStart = (event, pageId) => {
        if (!editingModeEnabled || reorderingPages) return;
        event.dataTransfer.effectAllowed = 'move';
        dropHandledRef.current = false;
        setDraggedPageId(pageId);
        setPageOrderIds(editable.page_order);
    };

    const handleDragEnter = (targetPageId) => {
        if (!draggedPageId || draggedPageId === targetPageId) return;
        setPageOrderIds((current) => moveListItem(
            current.length ? current : editable.page_order,
            draggedPageId,
            targetPageId,
        ));
    };

    const handleDrop = async (targetPageId) => {
        if (!draggedPageId) return;

        dropHandledRef.current = true;
        const sourceIds = pageOrderIds.length ? pageOrderIds : editable.page_order;
        const nextIds = moveListItem(sourceIds, draggedPageId, targetPageId);
        const changed = nextIds.some((id, index) => id !== editable.page_order[index]);

        if (!changed) {
            setDraggedPageId(null);
            setPageOrderIds(editable.page_order);
            return;
        }

        setPageOrderIds(nextIds);
        await persistPageOrder(nextIds);
    };

    const handleDragEnd = () => {
        if (!dropHandledRef.current && !reorderingPages) {
            setPageOrderIds(editable.page_order);
        }
        dropHandledRef.current = false;
        setDraggedPageId(null);
    };

    const renamePage = async (page) => {
        const currentLabel = editable.custom_page_labels[page.id] || page.defaultLabel;
        const nextLabel = window.prompt(`Rename "${currentLabel}"`, currentLabel);
        if (nextLabel == null) return;

        const trimmed = nextLabel.trim();
        if (!trimmed || trimmed === currentLabel) return;

        setBusyPageId(page.id);
        try {
            await updateSettings({
                custom_page_labels: {
                    ...editable.custom_page_labels,
                    [page.id]: trimmed,
                },
            });
        } finally {
            setBusyPageId('');
        }
    };

    const togglePageVisibility = async (page) => {
        if (page.id === 'settings') return;

        setBusyPageId(page.id);
        try {
            await updateSettings({
                page_visibility: {
                    ...editable.page_visibility,
                    [page.id]: !(editable.page_visibility[page.id] !== false),
                },
            });
        } finally {
            setBusyPageId('');
        }
    };

    const renderPageLink = (page) => {
        const Icon = ICON_BY_PAGE_ID[page.id];
        const label = editable.custom_page_labels[page.id] || page.defaultLabel;

        if (!editingModeEnabled) {
            return (
                <NavLink
                    key={page.id}
                    to={page.to}
                    end={page.to === '/'}
                    className={({ isActive }) => `sidebar-link sidebar-link-${page.tone} ${isActive ? 'active' : ''}`}
                >
                    <Icon size={18} />
                    <span>{label}</span>
                </NavLink>
            );
        }

        return (
            <div
                key={page.id}
                className={`sidebar-edit-row ${draggedPageId === page.id ? 'dragging' : ''}`}
                draggable={!reorderingPages}
                onDragStart={(event) => handleDragStart(event, page.id)}
                onDragEnter={() => handleDragEnter(page.id)}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={() => handleDrop(page.id)}
                onDragEnd={handleDragEnd}
            >
                <div className="sidebar-edit-grip" title="Drag to reorder pages">
                    <GripVertical size={15} />
                </div>
                <NavLink
                    to={page.to}
                    end={page.to === '/'}
                    className={({ isActive }) => `sidebar-link sidebar-link-${page.tone} ${isActive ? 'active' : ''}`}
                >
                    <Icon size={18} />
                    <span>{label}</span>
                </NavLink>
                <div className="sidebar-row-actions">
                    <button
                        className="sidebar-tool-btn"
                        type="button"
                        title="Rename page label"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            renamePage(page);
                        }}
                        disabled={busyPageId === page.id}
                    >
                        <Pencil size={13} />
                    </button>
                    {page.id !== 'settings' && (
                        <button
                            className="sidebar-tool-btn"
                            type="button"
                            title="Hide page from sidebar"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                togglePageVisibility(page);
                            }}
                            disabled={busyPageId === page.id}
                        >
                            <EyeOff size={13} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <ChefHat size={26} strokeWidth={1.5} />
                <div className="sidebar-brand-text">
                    <span className="sidebar-app-name">Restaurant</span>
                    {profile && (
                        <span className="sidebar-resto-name">{profile.name}</span>
                    )}
                </div>
            </div>

            {editingModeEnabled && (
                <div className="sidebar-edit-mode-badge">
                    <Pencil size={14} />
                    <span>Editing mode live</span>
                </div>
            )}

            <nav className="sidebar-nav">
                {orderedVisiblePages.map(renderPageLink)}
            </nav>

            {editingModeEnabled && hiddenPages.length > 0 && (
                <div className="sidebar-hidden-pages">
                    <div className="sidebar-hidden-title">Hidden Pages</div>
                    <div className="sidebar-hidden-list">
                        {hiddenPages.map((page) => (
                            <button
                                key={page.id}
                                className="sidebar-hidden-page-btn"
                                type="button"
                                onClick={() => togglePageVisibility(page)}
                            >
                                <Eye size={13} />
                                <span>{editable.custom_page_labels[page.id] || page.defaultLabel}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="sidebar-footer">
                <div className="role-display">
                    {isAdmin ? <ShieldCheck size={16} /> : <User size={16} />}
                    <span className={`role-badge role-${role}`}>
                        {isAdmin ? 'Admin' : 'Waiter'}
                    </span>
                </div>

                {profile?.email && (
                    <div className="sidebar-email">{profile.email}</div>
                )}

                <button className="sidebar-secondary-action" onClick={switchRole} title="Switch role">
                    <RefreshCw size={15} />
                    <span>Switch Role</span>
                </button>

                <button className="sidebar-logout" onClick={logout} title="Sign out">
                    <LogOut size={15} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
