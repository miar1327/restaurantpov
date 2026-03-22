import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Trash2, Printer, Save, ChevronLeft, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import DeliveryAddressComposer from '../components/DeliveryAddressComposer';
import CustomerMemoryPicker from '../components/CustomerMemoryPicker';

const genItemId = () => `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

export default function NewOrder() {
    const { menuItems, categories, createOrder, settings, orders, isAdmin, loading } = useApp();
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const quickPickPanelRef = useRef(null);
    const quickPickSectionRefs = useRef(new Map());
    const quickPickChipRefs = useRef(new Map());

    const [orderType, setOrderType] = useState('takeaway');
    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [deliveryNote, setDeliveryNote] = useState('');
    const [deliveryCharge, setDeliveryCharge] = useState(settings.default_delivery_charge ?? 2.5);

    const [discount, setDiscount] = useState(0);
    const [items, setItems] = useState([]);
    const [itemInput, setItemInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [errors, setErrors] = useState({});
    const [noteTarget, setNoteTarget] = useState(null); // item id for note editing
    const [saving, setSaving] = useState(false);
    const [activeQuickPickCatId, setActiveQuickPickCatId] = useState(null);


    // Auto-focus item input
    useEffect(() => { inputRef.current?.focus(); }, []);

    useEffect(() => {
        setDeliveryCharge(settings.default_delivery_charge ?? 2.5);
    }, [settings.default_delivery_charge]);

    // Suggestions when typing
    useEffect(() => {
        if (!itemInput.trim()) { setSuggestions([]); return; }
        const q = itemInput.trim().toLowerCase();
        const matches = menuItems.filter((m) =>
            m.is_active && (m.item_number === q || m.name.toLowerCase().includes(q))
        ).slice(0, 6);
        setSuggestions(matches);
    }, [itemInput, menuItems]);

    const addItem = useCallback((menuItem) => {
        setItems((prev) => {
            const existing = prev.findIndex((i) => i.menu_item_id === menuItem.id);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = {
                    ...updated[existing],
                    quantity: updated[existing].quantity + 1,
                    line_total: (updated[existing].quantity + 1) * updated[existing].final_unit_price,
                };
                return updated;
            }
            return [...prev, {
                id: genItemId(),
                menu_item_id: menuItem.id,
                item_number: menuItem.item_number,
                item_name_snapshot: menuItem.name,
                unit_price_snapshot: menuItem.price,
                unit_price_override: null,
                final_unit_price: menuItem.price,
                quantity: 1,
                line_total: menuItem.price,
                item_note: '',
            }];
        });
        setItemInput('');
        setSuggestions([]);
        inputRef.current?.focus();
    }, []);

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            const q = itemInput.trim().toLowerCase();
            if (!q) return;
            // Exact match by number first
            const exactNumber = menuItems.find((m) => m.is_active && m.item_number === q);
            if (exactNumber) { addItem(exactNumber); return; }
            // First suggestion
            if (suggestions.length > 0) { addItem(suggestions[0]); return; }
        }
    };

    const updateQty = (id, delta) => {
        setItems((prev) => prev.map((i) => {
            if (i.id !== id) return i;
            const qty = Math.max(1, i.quantity + delta);
            return { ...i, quantity: qty, line_total: qty * i.final_unit_price };
        }));
    };

    const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

    const updateNote = (id, note) => {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, item_note: note } : i));
    };

    const applySavedCustomer = useCallback((customer) => {
        if (customer.name) setCustomerName(customer.name);
        if (customer.phone) setPhone(customer.phone);
        if (customer.address) setAddress(customer.address);
    }, []);

    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    const totalAmount = Math.max(0, subtotal + parseFloat(deliveryCharge || 0) - parseFloat(discount || 0));
    const totalArticles = items.reduce((s, i) => s + i.quantity, 0);

    const validate = () => {
        const e = {};
        if (items.length === 0) e.items = 'Please add at least one item.';
        if (orderType === 'delivery') {
            if (!phone.trim()) e.phone = 'Phone is required for delivery.';
            if (!address.trim()) e.address = 'Address is required for delivery.';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async (printAfter = false) => {
        if (!validate()) return;

        setSaving(true);
        try {
            const order = await createOrder({
                order_type: orderType,
                customer_name: customerName.trim() || null,
                phone: phone.trim() || null,
                address: address.trim() || null,
                delivery_note: deliveryNote.trim() || null,
                delivery_charge: orderType === 'delivery' ? parseFloat(deliveryCharge) || 0 : 0,
                discount_amount: parseFloat(discount) || 0,
                subtotal_amount: subtotal,
                total_amount: totalAmount,
                total_articles: totalArticles,
                items,
            });

            if (!order) return;

            if (printAfter) {
                navigate(`/receipt/${order.id}`);
            } else {
                navigate('/');
            }
        } finally {
            setSaving(false);
        }
    };

    // Group menu items by category for the quick-pick panel
    const activeCategories = categories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
    const quickPickCategories = activeCategories
        .map((cat) => ({
            ...cat,
            items: menuItems
                .filter((item) => item.category_id === cat.id && item.is_active)
                .sort((a, b) => a.item_number.localeCompare(b.item_number, undefined, { numeric: true })),
        }))
        .filter((cat) => cat.items.length > 0);
    useEffect(() => {
        setActiveQuickPickCatId((current) => {
            if (quickPickCategories.length === 0) return null;
            return quickPickCategories.some((cat) => cat.id === current)
                ? current
                : quickPickCategories[0].id;
        });
    }, [quickPickCategories]);

    useEffect(() => {
        if (!activeQuickPickCatId) return;
        quickPickChipRefs.current.get(activeQuickPickCatId)?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    }, [activeQuickPickCatId]);

    const scrollQuickPickToCategory = useCallback((categoryId) => {
        const panel = quickPickPanelRef.current;
        const section = quickPickSectionRefs.current.get(categoryId);
        if (!panel || !section) return;

        setActiveQuickPickCatId(categoryId);
        panel.scrollTo({
            top: Math.max(0, section.offsetTop - 116),
            behavior: 'smooth',
        });
    }, []);

    const handleQuickPickScroll = useCallback(() => {
        const panel = quickPickPanelRef.current;
        if (!panel || quickPickCategories.length === 0) return;

        const marker = panel.scrollTop + 124;
        let currentCategoryId = quickPickCategories[0].id;

        quickPickCategories.forEach((cat) => {
            const section = quickPickSectionRefs.current.get(cat.id);
            if (section && section.offsetTop <= marker) {
                currentCategoryId = cat.id;
            }
        });

        setActiveQuickPickCatId((current) => (
            current === currentCategoryId ? current : currentCategoryId
        ));
    }, [quickPickCategories]);

    if (loading) {
        return (
            <div className="page">
                <p className="muted">Loading restaurant data...</p>
            </div>
        );
    }

    return (
        <div className="page new-order-page">
            <div className="page-header">
                <button className="btn btn-ghost icon-btn" onClick={() => navigate('/')}>
                    <ChevronLeft size={18} />
                </button>
                <div>
                    <h1 className="page-title">New Order</h1>
                    <p className="page-subtitle">Fast order entry</p>
                </div>
            </div>

            <div className="new-order-layout">
                {/* Left: Order Form */}
                <div className="order-form-panel">
                    {/* Order Type */}
                    <div className="form-section">
                        <label className="section-label">Order Type</label>
                        <div className="order-type-toggle">
                            <button
                                className={`type-btn ${orderType === 'takeaway' ? 'active' : ''}`}
                                onClick={() => setOrderType('takeaway')}
                            >🥡 Takeaway</button>
                            <button
                                className={`type-btn ${orderType === 'delivery' ? 'active' : ''}`}
                                onClick={() => setOrderType('delivery')}
                            >🚗 Delivery</button>
                        </div>
                    </div>

                    {/* Customer Details */}
                    <div className="form-section">
                        <label className="section-label">Customer {orderType === 'takeaway' ? '(optional)' : ''}</label>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Name</label>
                                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
                            </div>
                            <div className="form-group">
                                <label>Phone {orderType === 'delivery' && <span className="required">*</span>}</label>
                                <input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 555-0100"
                                    className={errors.phone ? 'input-error' : ''}
                                />
                                {errors.phone && <span className="field-error">{errors.phone}</span>}
                            </div>
                        </div>
                        <CustomerMemoryPicker
                            orders={orders}
                            nameQuery={customerName}
                            phoneQuery={phone}
                            onSelect={applySavedCustomer}
                        />
                        {orderType === 'delivery' && (
                            <>
                                <div className="form-group">
                                    <label>Delivery Address <span className="required">*</span></label>
                                    <DeliveryAddressComposer
                                        value={address}
                                        onChange={setAddress}
                                        settings={settings}
                                        orders={orders}
                                        error={errors.address}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Delivery Note</label>
                                    <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Leave at door, call on arrival…" />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Fast Item Entry */}
                    <div className="form-section">
                        <label className="section-label">Add Items</label>
                        <div className="item-entry-wrap">
                            <div className="item-entry-input-row">
                                <input
                                    ref={inputRef}
                                    className="item-entry-input"
                                    placeholder="Type item # or name, then press Enter…"
                                    value={itemInput}
                                    onChange={(e) => setItemInput(e.target.value)}
                                    onKeyDown={handleInputKeyDown}
                                    autoComplete="off"
                                />
                            </div>
                            {suggestions.length > 0 && (
                                <div className="item-suggestions">
                                    {suggestions.map((m) => (
                                        <button key={m.id} className="suggestion-row" onMouseDown={() => addItem(m)}>
                                            <span className="item-num-badge">{m.item_number}</span>
                                            <span className="sug-name">{m.name}</span>
                                            <span className="sug-price">{formatCurrency(m.price)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {errors.items && (
                            <div className="error-banner"><AlertCircle size={14} /> {errors.items}</div>
                        )}
                    </div>

                    {/* Selected Items */}
                    {items.length > 0 && (
                        <div className="form-section">
                            <label className="section-label">Order Items ({totalArticles} article{totalArticles !== 1 ? 's' : ''})</label>
                            <div className="selected-items">
                                {items.map((item) => (
                                    <div key={item.id} className="selected-item">
                                        <div className="si-info">
                                            <div className="si-main">
                                                {item.item_number && <span className="si-code">{item.item_number}</span>}
                                                <span className="si-name">{item.item_name_snapshot}</span>
                                            </div>
                                            <span className="si-price">{formatCurrency(item.final_unit_price)} each</span>
                                        </div>
                                        <div className="si-controls">
                                            <button className="qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={12} /></button>
                                            <span className="qty">{item.quantity}</span>
                                            <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={12} /></button>
                                            <span className="si-line-total">{formatCurrency(item.line_total)}</span>
                                            <button className="icon-btn danger sm" onClick={() => removeItem(item.id)}><Trash2 size={13} /></button>
                                        </div>
                                        <div className="si-note-row">
                                            {noteTarget === item.id ? (
                                                <input
                                                    autoFocus
                                                    className="note-input"
                                                    placeholder="Add note (e.g. no onion, extra spicy)…"
                                                    value={item.item_note}
                                                    onChange={(e) => updateNote(item.id, e.target.value)}
                                                    onBlur={() => setNoteTarget(null)}
                                                />
                                            ) : (
                                                <button className="note-toggle" onClick={() => setNoteTarget(item.id)}>
                                                    {item.item_note || '+ Add note'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Charges (admin or delivery) */}
                    {(isAdmin || orderType === 'delivery') && (
                        <div className="form-section">
                            <label className="section-label">Charges</label>
                            <div className="form-row">
                                {orderType === 'delivery' && (
                                    <div className="form-group">
                                        <label>Delivery Charge (€)</label>
                                        <input type="number" step="0.5" min="0" value={deliveryCharge}
                                            onChange={(e) => setDeliveryCharge(e.target.value)} />
                                    </div>
                                )}
                                {isAdmin && (
                                    <div className="form-group">
                                        <label>Discount (€)</label>
                                        <input type="number" step="0.5" min="0" value={discount}
                                            onChange={(e) => setDiscount(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Totals */}
                    <div className="order-totals">
                        <div className="total-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                        {orderType === 'delivery' && parseFloat(deliveryCharge) > 0 && (
                            <div className="total-row"><span>Delivery</span><span>+{formatCurrency(deliveryCharge)}</span></div>
                        )}
                        {parseFloat(discount) > 0 && (
                            <div className="total-row"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>
                        )}
                        <div className="total-row grand"><span>Total</span><span>{formatCurrency(totalAmount)}</span></div>
                    </div>

                    {/* Actions */}
                    <div className="order-form-actions">
                        <button className="btn btn-outline" onClick={() => handleSave(false)} disabled={saving}>
                            <Save size={16} /> {saving ? 'Saving...' : 'Save Order'}
                        </button>
                        <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving}>
                            <Printer size={16} /> {saving ? 'Saving...' : 'Save & Print'}
                        </button>
                    </div>
                </div>

                {/* Right: Quick Pick Menu */}
                <div className="quick-pick-panel" ref={quickPickPanelRef} onScroll={handleQuickPickScroll}>
                    <div className="quick-pick-header">
                        <h3 className="quick-pick-title">Quick Pick</h3>
                        <div className="quick-pick-nav" aria-label="Quick Pick categories">
                            {quickPickCategories.map((cat) => (
                                <button
                                    key={cat.id}
                                    ref={(node) => {
                                        if (node) {
                                            quickPickChipRefs.current.set(cat.id, node);
                                        } else {
                                            quickPickChipRefs.current.delete(cat.id);
                                        }
                                    }}
                                    className={`quick-pick-nav-btn ${activeQuickPickCatId === cat.id ? 'active' : ''}`}
                                    onClick={() => scrollQuickPickToCategory(cat.id)}
                                >
                                    <span>{cat.name}</span>
                                    <small>{cat.items.length}</small>
                                </button>
                            ))}
                        </div>
                    </div>
                    {quickPickCategories.map((cat) => (
                        <div
                            key={cat.id}
                            className="quick-pick-category"
                            ref={(node) => {
                                if (node) {
                                    quickPickSectionRefs.current.set(cat.id, node);
                                } else {
                                    quickPickSectionRefs.current.delete(cat.id);
                                }
                            }}
                        >
                            <div className="quick-pick-cat-name">{cat.name}</div>
                            <div className="quick-pick-items">
                                {cat.items.map((m) => (
                                    <button key={m.id} className="quick-pick-btn" onClick={() => addItem(m)}>
                                        <span className="qp-num">{m.item_number}</span>
                                        <span className="qp-name">{m.name}</span>
                                        <span className="qp-price">{formatCurrency(m.price)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
