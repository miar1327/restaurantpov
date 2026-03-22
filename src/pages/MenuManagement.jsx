import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight, AlertCircle, Upload, Link2, GripVertical } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import {
    addCategory, updateCategory, deleteCategory,
    addMenuItem, updateMenuItem, deleteMenuItem, importMenu,
} from '../utils/storage.js';
import {
    MENU_IMPORT_REQUIRED_COLUMNS,
    parseMenuImportFile,
    parseMenuImportGoogleSheet,
} from '../utils/menuImport.js';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyCategory = () => ({ name: '', sort_order: 0, is_active: true });
const emptyItem = () => ({ item_number: '', name: '', category_id: '', price: '', is_active: true, notes: '' });
const moveCategoryId = (ids, sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return ids;

    const nextIds = [...ids];
    const sourceIndex = nextIds.indexOf(sourceId);
    const targetIndex = nextIds.indexOf(targetId);

    if (sourceIndex === -1 || targetIndex === -1) return ids;

    const [movedId] = nextIds.splice(sourceIndex, 1);
    nextIds.splice(targetIndex, 0, movedId);
    return nextIds;
};

export default function MenuManagement() {
    const { categories, menuItems, isAdmin, refresh, loading } = useApp();
    const [selectedCatId, setSelectedCatId] = useState(null);
    const [catForm, setCatForm] = useState(null); // null=closed, {}=new, {id,...}=edit
    const [itemForm, setItemForm] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [catError, setCatError] = useState('');
    const [itemError, setItemError] = useState('');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importError, setImportError] = useState('');
    const [importBusy, setImportBusy] = useState(false);
    const [importPreview, setImportPreview] = useState(null);
    const [sheetUrl, setSheetUrl] = useState('');
    const [replaceExisting, setReplaceExisting] = useState(false);
    const [importNotice, setImportNotice] = useState('');
    const [draggedCatId, setDraggedCatId] = useState(null);
    const [categoryOrderIds, setCategoryOrderIds] = useState([]);
    const [reorderingCategories, setReorderingCategories] = useState(false);
    const fileInputRef = useRef(null);
    const itemsPanelRef = useRef(null);
    const dropHandledRef = useRef(false);

    const activeCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const orderedCategories = categoryOrderIds.length
        ? categoryOrderIds.map((id) => activeCategories.find((entry) => entry.id === id)).filter(Boolean)
        : activeCategories;
    const catItems = menuItems
        .filter((m) => m.category_id === selectedCatId)
        .sort((a, b) => a.item_number.localeCompare(b.item_number, undefined, { numeric: true }));

    useEffect(() => {
        if (draggedCatId || reorderingCategories) return;
        const nextIds = activeCategories.map((entry) => entry.id);
        setCategoryOrderIds((current) => (
            current.length === nextIds.length && current.every((id, index) => id === nextIds[index])
                ? current
                : nextIds
        ));
    }, [activeCategories, draggedCatId, reorderingCategories]);

    useEffect(() => {
        if (!selectedCatId || activeCategories.some((entry) => entry.id === selectedCatId)) return;
        setSelectedCatId(activeCategories[0]?.id ?? null);
    }, [activeCategories, selectedCatId]);

    useEffect(() => {
        if (!selectedCatId) return;
        itemsPanelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, [selectedCatId]);

    const openCatForm = (cat = null) => {
        setCatForm(cat ? { ...cat } : emptyCategory());
        setCatError('');
    };
    const openItemForm = (item = null) => {
        setItemForm(item ? { ...item } : { ...emptyItem(), category_id: selectedCatId ?? '' });
        setItemError('');
    };
    const closeImportModal = () => {
        setImportModalOpen(false);
        setImportError('');
        setImportBusy(false);
        setImportPreview(null);
        setSheetUrl('');
        setReplaceExisting(false);
    };
    const openImportModal = () => {
        setImportNotice('');
        setImportError('');
        setImportPreview(null);
        setSheetUrl('');
        setReplaceExisting(false);
        setImportModalOpen(true);
    };

    const saveCat = async () => {
        if (!catForm.name.trim()) { setCatError('Name is required'); return; }
        try {
            if (catForm.id) {
                await updateCategory(catForm.id, { name: catForm.name.trim(), sort_order: parseInt(catForm.sort_order, 10) || 0, is_active: catForm.is_active });
            } else {
                await addCategory({ name: catForm.name.trim(), sort_order: parseInt(catForm.sort_order, 10) || orderedCategories.length, is_active: catForm.is_active });
            }
            await refresh();
            setCatForm(null);
        } catch (err) {
            setCatError(err.message ?? 'Unable to save the category.');
        }
    };

    const persistCategoryOrder = async (nextIds) => {
        setReorderingCategories(true);
        setCatError('');

        try {
            await Promise.all(nextIds.map((id, index) => {
                const category = activeCategories.find((entry) => entry.id === id);
                if (!category || category.sort_order === index) return null;
                return updateCategory(id, {
                    name: category.name,
                    sort_order: index,
                    is_active: category.is_active,
                });
            }).filter(Boolean));

            const payload = await refresh();
            const nextCategories = [...(payload?.categories ?? [])].sort((a, b) => a.sort_order - b.sort_order);
            setCategoryOrderIds(nextCategories.map((entry) => entry.id));
        } catch (err) {
            setCategoryOrderIds(activeCategories.map((entry) => entry.id));
            setCatError(err.message ?? 'Unable to save the category order.');
        } finally {
            setDraggedCatId(null);
            setReorderingCategories(false);
        }
    };

    const handleCatDragStart = (event, catId) => {
        if (!isAdmin || reorderingCategories) return;
        event.dataTransfer.effectAllowed = 'move';
        dropHandledRef.current = false;
        setDraggedCatId(catId);
        setCategoryOrderIds((current) => current.length ? current : activeCategories.map((entry) => entry.id));
        setCatError('');
    };

    const handleCatDragEnter = (targetCatId) => {
        if (!draggedCatId || draggedCatId === targetCatId) return;
        setCategoryOrderIds((current) => moveCategoryId(
            current.length ? current : activeCategories.map((entry) => entry.id),
            draggedCatId,
            targetCatId,
        ));
    };

    const handleCatDrop = async (targetCatId) => {
        if (!draggedCatId) return;

        dropHandledRef.current = true;
        const sourceIds = categoryOrderIds.length ? categoryOrderIds : activeCategories.map((entry) => entry.id);
        const nextIds = moveCategoryId(sourceIds, draggedCatId, targetCatId);
        const changed = nextIds.some((id, index) => id !== sourceIds[index]);

        if (!changed) {
            setDraggedCatId(null);
            setCategoryOrderIds(activeCategories.map((entry) => entry.id));
            return;
        }

        setCategoryOrderIds(nextIds);
        await persistCategoryOrder(nextIds);
    };

    const handleCatDragEnd = () => {
        if (!dropHandledRef.current && !reorderingCategories) {
            setCategoryOrderIds(activeCategories.map((entry) => entry.id));
        }
        dropHandledRef.current = false;
        setDraggedCatId(null);
    };

    const handleImportFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setImportBusy(true);
        setImportError('');

        try {
            const parsed = await parseMenuImportFile(file);
            setImportPreview(parsed);
        } catch (err) {
            setImportPreview(null);
            setImportError(err.message ?? 'Unable to read that spreadsheet.');
        } finally {
            setImportBusy(false);
        }
    };

    const handleLoadSheet = async () => {
        if (!sheetUrl.trim()) {
            setImportError('Paste a Google Sheet link first.');
            return;
        }

        setImportBusy(true);
        setImportError('');

        try {
            const parsed = await parseMenuImportGoogleSheet(sheetUrl);
            setImportPreview(parsed);
        } catch (err) {
            setImportPreview(null);
            setImportError(err.message ?? 'Unable to load that Google Sheet.');
        } finally {
            setImportBusy(false);
        }
    };

    const handleRunImport = async () => {
        if (!importPreview?.items?.length) {
            setImportError('Upload a spreadsheet or load a Google Sheet first.');
            return;
        }

        setImportBusy(true);
        setImportError('');

        try {
            const result = await importMenu({
                items: importPreview.items,
                replaceExisting,
            });

            const payload = await refresh();
            const nextCategories = payload?.categories ?? [];
            setSelectedCatId((current) => (
                nextCategories.some((entry) => entry.id === current)
                    ? current
                    : (nextCategories[0]?.id ?? null)
            ));

            const summary = replaceExisting
                ? `Menu replaced with ${result.totalCategories} categories and ${result.totalItems} items.`
                : `Imported ${result.itemsCreated} new items, updated ${result.itemsUpdated} existing items, and added ${result.categoriesCreated} categories.`;
            setImportNotice(summary);
            closeImportModal();
        } catch (err) {
            if (err?.status === 404) {
                setImportError('Menu import API not found. Restart the local server or redeploy the backend, then try the import again.');
                return;
            }
            setImportError(err.message ?? 'Unable to import the menu right now.');
        } finally {
            setImportBusy(false);
        }
    };

    const deleteCat = (cat) => {
        setConfirmDelete({
            title: 'Delete Category',
            message: `Delete "${cat.name}"? All items in this category will also be deleted.`,
            onConfirm: async () => {
                await deleteCategory(cat.id);
                if (selectedCatId === cat.id) setSelectedCatId(null);
                await refresh();
                setConfirmDelete(null);
            },
        });
    };

    const saveItem = async () => {
        if (!itemForm.name.trim()) { setItemError('Name is required'); return; }
        if (!itemForm.item_number.trim()) { setItemError('Item # is required'); return; }
        if (isNaN(parseFloat(itemForm.price)) || parseFloat(itemForm.price) < 0) { setItemError('Valid price required'); return; }
        // Uniqueness check
        const duplicate = menuItems.find(
            (m) => m.item_number === itemForm.item_number.trim() && m.id !== itemForm.id
        );
        if (duplicate) { setItemError(`Item # ${itemForm.item_number} already exists`); return; }
        try {
            if (itemForm.id) {
                await updateMenuItem(itemForm.id, {
                    item_number: itemForm.item_number.trim(),
                    name: itemForm.name.trim(),
                    category_id: itemForm.category_id,
                    price: parseFloat(itemForm.price),
                    is_active: itemForm.is_active,
                    notes: itemForm.notes,
                });
            } else {
                await addMenuItem({
                    item_number: itemForm.item_number.trim(),
                    name: itemForm.name.trim(),
                    category_id: itemForm.category_id || selectedCatId,
                    price: parseFloat(itemForm.price),
                    is_active: itemForm.is_active,
                    notes: itemForm.notes,
                });
            }
            await refresh();
            setItemForm(null);
        } catch (err) {
            setItemError(err.message ?? 'Unable to save the item.');
        }
    };

    const deleteItem = (item) => {
        setConfirmDelete({
            title: 'Delete Item',
            message: `Delete "${item.name}" (#${item.item_number})?`,
            onConfirm: async () => {
                await deleteMenuItem(item.id);
                await refresh();
                setConfirmDelete(null);
            },
        });
    };

    const toggleItemActive = async (item) => {
        await updateMenuItem(item.id, {
            item_number: item.item_number,
            name: item.name,
            category_id: item.category_id,
            price: item.price,
            is_active: !item.is_active,
            notes: item.notes,
        });
        await refresh();
    };

    if (loading) {
        return (
            <div className="page">
                <p className="muted">Loading restaurant data...</p>
            </div>
        );
    }

    return (
        <div className="page menu-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Menu Management</h1>
                    <p className="page-subtitle">Categories &amp; items</p>
                </div>
                {isAdmin && (
                    <div className="menu-header-actions">
                        <button className="btn btn-outline" onClick={openImportModal}>
                            <Upload size={16} /> Import Spreadsheet
                        </button>
                        <button className="btn btn-primary" onClick={() => openCatForm()}>
                            <Plus size={16} /> Add Category
                        </button>
                    </div>
                )}
            </div>

            {importNotice && (
                <div className="import-feedback-banner">
                    <Check size={16} />
                    <span>{importNotice}</span>
                </div>
            )}

            <div className="menu-layout">
                {/* Categories Panel */}
                <div className="menu-cat-panel">
                    <div className="panel-header">
                        <div>
                            <h3>Categories</h3>
                            {isAdmin && <p className="panel-header-note">Drag to reorder the menu flow.</p>}
                        </div>
                    </div>
                    {orderedCategories.length === 0 && <p className="muted panel-empty">No categories yet.</p>}
                    {orderedCategories.map((cat) => (
                        <div
                            key={cat.id}
                            className={`cat-row ${selectedCatId === cat.id ? 'active' : ''} ${draggedCatId === cat.id ? 'dragging' : ''}`}
                            onClick={() => setSelectedCatId(cat.id)}
                            draggable={isAdmin && !reorderingCategories}
                            onDragStart={(event) => handleCatDragStart(event, cat.id)}
                            onDragEnter={() => handleCatDragEnter(cat.id)}
                            onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={() => handleCatDrop(cat.id)}
                            onDragEnd={handleCatDragEnd}
                        >
                            {isAdmin && <GripVertical size={15} className="cat-grip" />}
                            <span className="cat-name">{cat.name}</span>
                            <span className="cat-count">{menuItems.filter((m) => m.category_id === cat.id).length}</span>
                            {isAdmin && (
                                <div className="cat-actions" onClick={(e) => e.stopPropagation()}>
                                    <button className="icon-btn sm" onClick={() => openCatForm(cat)}><Pencil size={13} /></button>
                                    <button className="icon-btn sm danger" onClick={() => deleteCat(cat)}><Trash2 size={13} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Items Panel */}
                <div className="menu-items-panel" ref={itemsPanelRef}>
                    <div className="panel-header">
                        <h3>
                            {selectedCatId
                                ? `Items — ${categories.find((c) => c.id === selectedCatId)?.name ?? ''}`
                                : 'All Items (select a category)'}
                        </h3>
                        {isAdmin && selectedCatId && (
                            <button className="btn btn-sm btn-primary" onClick={() => openItemForm()}>
                                <Plus size={14} /> Add Item
                            </button>
                        )}
                    </div>

                    {!selectedCatId && (
                        <p className="muted panel-empty">Select a category to manage items.</p>
                    )}

                    {selectedCatId && catItems.length === 0 && (
                        <p className="muted panel-empty">No items in this category yet.</p>
                    )}

                    {catItems.map((item) => (
                        <div key={item.id} className={`item-row ${!item.is_active ? 'inactive' : ''}`}>
                            <span className="item-num-badge">{item.item_number}</span>
                            <div className="item-info">
                                <span className="item-name">{item.name}</span>
                                {item.notes && <span className="item-notes-tag">{item.notes}</span>}
                            </div>
                            <span className="item-price">{formatCurrency(item.price)}</span>
                            {isAdmin && (
                                <div className="item-actions">
                                    <button
                                        className="icon-btn sm"
                                        title={item.is_active ? 'Deactivate' : 'Activate'}
                                        onClick={() => toggleItemActive(item)}
                                    >
                                        {item.is_active ? <ToggleRight size={16} className="green" /> : <ToggleLeft size={16} />}
                                    </button>
                                    <button className="icon-btn sm" onClick={() => openItemForm(item)}><Pencil size={13} /></button>
                                    <button className="icon-btn sm danger" onClick={() => deleteItem(item)}><Trash2 size={13} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Category Form Modal */}
            {catForm && (
                <div className="modal-overlay" onClick={() => setCatForm(null)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{catForm.id ? 'Edit Category' : 'New Category'}</h2>
                            <button className="icon-btn" onClick={() => setCatForm(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Category Name *</label>
                                <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Starters" />
                            </div>
                            <div className="form-group">
                                <label>Sort Order</label>
                                <input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })} />
                            </div>
                            {catError && <div className="error-banner"><AlertCircle size={14} />{catError}</div>}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setCatForm(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveCat}><Check size={15} /> Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Form Modal */}
            {itemForm && (
                <div className="modal-overlay" onClick={() => setItemForm(null)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{itemForm.id ? 'Edit Item' : 'New Item'}</h2>
                            <button className="icon-btn" onClick={() => setItemForm(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Item # *</label>
                                    <input value={itemForm.item_number}
                                        onChange={(e) => setItemForm({ ...itemForm, item_number: e.target.value })}
                                        placeholder="e.g. 21" />
                                </div>
                                <div className="form-group">
                                    <label>Price (€) *</label>
                                    <input type="number" step="0.01" min="0" value={itemForm.price}
                                        onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                                        placeholder="12.90" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Item Name *</label>
                                <input value={itemForm.name}
                                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                                    placeholder="e.g. Chicken Curry" />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <select value={itemForm.category_id}
                                    onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>
                                    <option value="">— Select —</option>
                                    {activeCategories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Notes (optional)</label>
                                <input value={itemForm.notes}
                                    onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                                    placeholder="e.g. Vegetarian, Contains nuts" />
                            </div>
                            <div className="form-group toggle-row">
                                <label>Active</label>
                                <button className="toggle-btn" onClick={() => setItemForm({ ...itemForm, is_active: !itemForm.is_active })}>
                                    {itemForm.is_active ? <ToggleRight size={28} className="green" /> : <ToggleLeft size={28} />}
                                </button>
                            </div>
                            {itemError && <div className="error-banner"><AlertCircle size={14} /> {itemError}</div>}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setItemForm(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveItem}><Check size={15} /> Save</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <ConfirmDialog
                    title={confirmDelete.title}
                    message={confirmDelete.message}
                    onConfirm={confirmDelete.onConfirm}
                    onCancel={() => setConfirmDelete(null)}
                    confirmLabel="Delete"
                    danger
                />
            )}

            {importModalOpen && (
                <div className="modal-overlay" onClick={closeImportModal}>
                    <div className="modal-box menu-import-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Import Menu from Google Sheet or Excel</h2>
                            <button className="icon-btn" onClick={closeImportModal}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <p className="menu-import-helper">
                                Required columns: <strong>{MENU_IMPORT_REQUIRED_COLUMNS.join(', ')}</strong>.
                                Optional columns: <strong>Notes</strong> and <strong>Active</strong>.
                            </p>

                            <div className="menu-import-actions">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.csv"
                                    className="menu-import-file-input"
                                    onChange={handleImportFile}
                                />
                                <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={importBusy}>
                                    <Upload size={15} /> Upload Excel / CSV
                                </button>
                            </div>

                            <div className="form-group">
                                <label>Google Sheet URL</label>
                                <div className="menu-import-sheet-row">
                                    <input
                                        value={sheetUrl}
                                        onChange={(e) => setSheetUrl(e.target.value)}
                                        placeholder="Paste a public Google Sheet link"
                                    />
                                    <button className="btn btn-outline" onClick={handleLoadSheet} disabled={importBusy}>
                                        <Link2 size={15} /> Load Sheet
                                    </button>
                                </div>
                                <p className="helper-text">
                                    The Google Sheet must be shared publicly or published so this browser can fetch it.
                                </p>
                            </div>

                            <div className="form-group toggle-row">
                                <label>Replace current menu before import</label>
                                <button className="toggle-btn" onClick={() => setReplaceExisting((value) => !value)}>
                                    {replaceExisting ? <ToggleRight size={28} className="green" /> : <ToggleLeft size={28} />}
                                </button>
                            </div>

                            {replaceExisting && (
                                <div className="menu-import-warning">
                                    This will remove the current categories and items, then rebuild the menu from the spreadsheet.
                                </div>
                            )}

                            {importError && <div className="error-banner"><AlertCircle size={14} /> {importError}</div>}

                            {importPreview && (
                                <div className="menu-import-preview">
                                    <div className="menu-import-stats">
                                        <div className="menu-import-stat">
                                            <span>Source</span>
                                            <strong>{importPreview.sourceLabel}</strong>
                                        </div>
                                        <div className="menu-import-stat">
                                            <span>Categories</span>
                                            <strong>{importPreview.categories.length}</strong>
                                        </div>
                                        <div className="menu-import-stat">
                                            <span>Items</span>
                                            <strong>{importPreview.items.length}</strong>
                                        </div>
                                    </div>

                                    <div className="menu-import-preview-table">
                                        <div className="menu-import-preview-head">
                                            <span>Category</span>
                                            <span>#</span>
                                            <span>Item</span>
                                            <span>Price</span>
                                        </div>
                                        {importPreview.previewRows.map((row) => (
                                            <div key={`${row.item_number}-${row.name}`} className="menu-import-preview-row">
                                                <span>{row.category_name}</span>
                                                <span>{row.item_number}</span>
                                                <span>{row.name}</span>
                                                <span>{formatCurrency(row.price)}</span>
                                            </div>
                                        ))}
                                        {importPreview.items.length > importPreview.previewRows.length && (
                                            <p className="menu-import-helper">
                                                Showing the first {importPreview.previewRows.length} rows of {importPreview.items.length}.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={closeImportModal}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleRunImport} disabled={importBusy || !importPreview}>
                                <Check size={15} /> {importBusy ? 'Importing...' : 'Import Menu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
