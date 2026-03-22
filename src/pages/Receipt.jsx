import { useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ChevronLeft } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { useApp } from '../context/AppContext';

export default function Receipt() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const printTriggered = useRef(false);
    const { orders, settings, menuItems, loading } = useApp();

    const order = orders.find((o) => o.id === orderId);
    const itemNumberByMenuItemId = useMemo(
        () => new Map(menuItems.map((item) => [item.id, item.item_number])),
        [menuItems],
    );


    useEffect(() => {
        if (order && !printTriggered.current) {
            printTriggered.current = true;
            setTimeout(() => window.print(), 400);
        }
    }, [order]);

    if (loading) {
        return (
            <div className="page">
                <p>Loading receipt...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="page">
                <p>Order not found.</p>
                <button className="btn btn-ghost" onClick={() => navigate('/')}>Back to Dashboard</button>
            </div>
        );
    }

    const items = order.items ?? [];
    const subtotal = items.reduce((s, i) => s + i.line_total, 0);

    return (
        <div className="receipt-page">
            {/* Screen-only controls */}
            <div className="receipt-controls no-print">
                <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                    <ChevronLeft size={16} /> Back
                </button>
                <button className="btn btn-primary" onClick={() => window.print()}>
                    <Printer size={16} /> Print Receipt
                </button>
            </div>

            {/* Printable Receipt */}
            <div className="receipt-paper">
                {/* Header */}
                <div className="receipt-header">
                    <h1 className="r-restaurant-name">{settings.restaurant_name}</h1>
                    {settings.address && <p className="r-meta">{settings.address}</p>}
                    {settings.phone && <p className="r-meta">{settings.phone}</p>}
                </div>

                <div className="r-divider">{'─'.repeat(32)}</div>

                {/* Order Info */}
                <div className="r-info-block">
                    <div className="r-row"><span>Ticket No:</span><span className="r-val bold">{order.ticket_number}</span></div>
                    <div className="r-row"><span>Order Type:</span><span className="r-val">{order.order_type === 'delivery' ? 'Delivery' : 'Takeaway'}</span></div>
                    {order.customer_name && <div className="r-row"><span>Customer:</span><span className="r-val">{order.customer_name}</span></div>}
                    {order.phone && <div className="r-row"><span>Phone:</span><span className="r-val">{order.phone}</span></div>}
                    {order.address && <div className="r-row"><span>Address:</span><span className="r-val">{order.address}</span></div>}
                    {order.delivery_note && <div className="r-row"><span>Note:</span><span className="r-val">{order.delivery_note}</span></div>}
                    <div className="r-row"><span>Date/Time:</span><span className="r-val">{formatDateTime(order.ordered_at)}</span></div>
                </div>

                <div className="r-divider">{'─'.repeat(32)}</div>

                {/* Items */}
                <table className="r-items-table">
                    <thead>
                        <tr>
                            <th className="r-th-item">Item</th>
                            <th className="r-th-qty">Qty</th>
                            <th className="r-th-price">Unit</th>
                            <th className="r-th-total">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            const itemNumber = item.item_number || itemNumberByMenuItemId.get(item.menu_item_id) || '';

                            return (
                                <tr key={idx}>
                                    <td>
                                        <div className="r-item-main">
                                            {itemNumber && <span className="r-item-number">{itemNumber}</span>}
                                            <span className="r-item-name">{item.item_name_snapshot}</span>
                                        </div>
                                        {item.item_note && <div className="r-item-note">* {item.item_note}</div>}
                                    </td>
                                    <td className="r-center">{item.quantity}</td>
                                    <td className="r-right">{formatCurrency(item.final_unit_price)}</td>
                                    <td className="r-right">{formatCurrency(item.line_total)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="r-divider">{'─'.repeat(32)}</div>

                {/* Totals */}
                <div className="r-totals">
                    <div className="r-total-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                    {parseFloat(order.delivery_charge) > 0 && (
                        <div className="r-total-row"><span>Delivery Charge</span><span>+{formatCurrency(order.delivery_charge)}</span></div>
                    )}
                    {parseFloat(order.discount_amount) > 0 && (
                        <div className="r-total-row"><span>Discount</span><span>-{formatCurrency(order.discount_amount)}</span></div>
                    )}
                    <div className="r-divider">{'─'.repeat(32)}</div>
                    <div className="r-total-row grand-total">
                        <span>TOTAL</span>
                        <span>{formatCurrency(order.total_amount)}</span>
                    </div>
                    <div className="r-total-row muted"><span>Total Articles</span><span>{order.total_articles}</span></div>
                </div>

                <div className="r-divider">{'─'.repeat(32)}</div>
                <div className="r-footer">
                    <p>Thank you for your order!</p>
                    <p className="r-small">Status: {order.status?.toUpperCase()}</p>
                </div>
            </div>
        </div>
    );
}
