import { useState } from 'react';
import { X, Plus, Minus, Trash2, DollarSign } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import DeliveryAddressComposer from './DeliveryAddressComposer';
import CustomerMemoryPicker from './CustomerMemoryPicker';


export default function OrderEditModal({ order, onClose }) {
    const { menuItems, editOrder, settings, orders } = useApp();
    const [items, setItems] = useState(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
    const [customerName, setCustomerName] = useState(order.customer_name || '');
    const [phone, setPhone] = useState(order.phone || '');
    const [address, setAddress] = useState(order.address || '');
    const [deliveryNote, setDeliveryNote] = useState(order.delivery_note || '');
    const [deliveryCharge, setDeliveryCharge] = useState(order.delivery_charge || 0);
    const [discount, setDiscount] = useState(order.discount_amount || 0);
    const [priceChangeReason, setPriceChangeReason] = useState('');
    const [itemSearch, setItemSearch] = useState('');
    const [saving, setSaving] = useState(false);

    const applySavedCustomer = (customer) => {
        if (customer.name) setCustomerName(customer.name);
        if (customer.phone) setPhone(customer.phone);
        if (customer.address) setAddress(customer.address);
    };

    const calcTotal = (its, dc, disc) => {
        const subtotal = its.reduce((s, i) => s + i.line_total, 0);
        return Math.max(0, subtotal + parseFloat(dc || 0) - parseFloat(disc || 0));
    };

    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    const total = calcTotal(items, deliveryCharge, discount);

    const updateQty = (idx, delta) => {
        setItems((prev) => {
            const updated = [...prev];
            const item = { ...updated[idx] };
            item.quantity = Math.max(1, item.quantity + delta);
            item.line_total = item.final_unit_price * item.quantity;
            updated[idx] = item;
            return updated;
        });
    };

    const removeItem = (idx) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const overridePrice = (idx, newPrice) => {
        setItems((prev) => {
            const updated = [...prev];
            const item = { ...updated[idx] };
            item.unit_price_override = parseFloat(newPrice) || item.unit_price_snapshot;
            item.final_unit_price = item.unit_price_override;
            item.line_total = item.final_unit_price * item.quantity;
            item.price_changed_by = 'admin';
            item.price_changed_at = new Date().toISOString();
            item.price_change_reason = priceChangeReason;
            updated[idx] = item;
            return updated;
        });
    };

    const addItemFromMenu = (menuItem) => {
        const existing = items.findIndex((i) => i.menu_item_id === menuItem.id);
        if (existing >= 0) {
            updateQty(existing, 1);
        } else {
            const newItem = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                order_id: order.id,
                menu_item_id: menuItem.id,
                item_number: menuItem.item_number,
                item_name_snapshot: menuItem.name,
                unit_price_snapshot: menuItem.price,
                unit_price_override: null,
                final_unit_price: menuItem.price,
                quantity: 1,
                line_total: menuItem.price,
                item_note: '',
            };
            setItems((prev) => [...prev, newItem]);
        }
        setItemSearch('');
    };

    const filteredMenu = itemSearch
        ? menuItems.filter((m) =>
            m.is_active &&
            (m.item_number.includes(itemSearch) ||
                m.name.toLowerCase().includes(itemSearch.toLowerCase()))
        ).slice(0, 5)
        : [];

    const handleSave = async () => {
        const totalArticles = items.reduce((s, i) => s + i.quantity, 0);
        const subtotalAmt = items.reduce((s, i) => s + i.line_total, 0);
        const totalAmt = calcTotal(items, deliveryCharge, discount);

        setSaving(true);
        try {
            await editOrder(order.id, {
                items,
                customer_name: customerName,
                phone,
                address,
                delivery_note: deliveryNote,
                delivery_charge: parseFloat(deliveryCharge) || 0,
                discount_amount: parseFloat(discount) || 0,
                subtotal_amount: subtotalAmt,
                total_amount: totalAmt,
                total_articles: totalArticles,
            }, { reason: priceChangeReason || 'Admin edit' });

            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box edit-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Order <span className="muted">#{order.ticket_number}</span></h2>
                    <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="modal-body">
                    {/* Customer Info */}
                    <div className="edit-section">
                        <h3>Customer Info</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Name</label>
                                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                            </div>
                        </div>
                        <CustomerMemoryPicker
                            orders={orders}
                            nameQuery={customerName}
                            phoneQuery={phone}
                            onSelect={applySavedCustomer}
                        />
                        {order.order_type === 'delivery' && (
                            <>
                                <div className="form-group">
                                    <label>Address</label>
                                    <DeliveryAddressComposer
                                        value={address}
                                        onChange={setAddress}
                                        settings={settings}
                                        orders={orders}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Delivery Note</label>
                                    <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Add Items */}
                    <div className="edit-section">
                        <h3>Add Items</h3>
                        <div className="item-search-wrap">
                            <input
                                placeholder="Type item # or name…"
                                value={itemSearch}
                                onChange={(e) => setItemSearch(e.target.value)}
                            />
                            {filteredMenu.length > 0 && (
                                <div className="item-dropdown">
                                    {filteredMenu.map((m) => (
                                        <button key={m.id} className="item-drop-row" onClick={() => addItemFromMenu(m)}>
                                            <span className="item-num">{m.item_number}</span>
                                            <span>{m.name}</span>
                                            <span className="item-price">{formatCurrency(m.price)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="edit-section">
                        <h3>Order Items</h3>
                        {items.length === 0 ? (
                            <p className="muted">No items</p>
                        ) : (
                            <div className="edit-items-list">
                                {items.map((item, idx) => (
                                    <div key={item.id} className="edit-item-row">
                                        <div className="edit-item-name">
                                            <span>{item.item_name_snapshot}</span>
                                            {item.unit_price_override && (
                                                <span className="price-override-tag">Price overridden</span>
                                            )}
                                        </div>
                                        <div className="edit-item-controls">
                                            <button className="icon-btn sm" onClick={() => updateQty(idx, -1)}><Minus size={12} /></button>
                                            <span className="qty">{item.quantity}</span>
                                            <button className="icon-btn sm" onClick={() => updateQty(idx, 1)}><Plus size={12} /></button>
                                            <div className="price-override-wrap">
                                                <DollarSign size={12} />
                                                <input
                                                    type="number"
                                                    className="price-input-sm"
                                                    value={item.final_unit_price}
                                                    step="0.01"
                                                    min="0"
                                                    onChange={(e) => overridePrice(idx, e.target.value)}
                                                />
                                            </div>
                                            <span className="line-total">{formatCurrency(item.line_total)}</span>
                                            <button className="icon-btn danger sm" onClick={() => removeItem(idx)}><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Charges */}
                    <div className="edit-section">
                        <h3>Charges & Notes</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Delivery Charge (€)</label>
                                <input type="number" step="0.50" min="0" value={deliveryCharge}
                                    onChange={(e) => setDeliveryCharge(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Discount (€)</label>
                                <input type="number" step="0.50" min="0" value={discount}
                                    onChange={(e) => setDiscount(e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Price Change Reason</label>
                            <input
                                placeholder="e.g. Customer requested discount"
                                value={priceChangeReason}
                                onChange={(e) => setPriceChangeReason(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="edit-totals">
                        <div className="total-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                        {parseFloat(deliveryCharge) > 0 && (
                            <div className="total-row"><span>Delivery</span><span>+{formatCurrency(deliveryCharge)}</span></div>
                        )}
                        {parseFloat(discount) > 0 && (
                            <div className="total-row"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>
                        )}
                        <div className="total-row grand"><span>Total</span><span>{formatCurrency(total)}</span></div>
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
