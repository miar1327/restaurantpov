import { useNavigate } from 'react-router-dom';
import { Truck, ShoppingBag, ChevronRight, Clock, Printer, Pencil, Ban, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { STATUS_CONFIG } from './statusConfig';
import { useApp } from '../context/AppContext';
import { formatTime, formatCurrency, durationMinutes } from '../utils/formatters';
import { useLiveTime } from '../hooks/useLiveTime';

export default function OrderCard({ order, onAdvance, onEdit, onCancel, onDelete }) {
    const { isAdmin } = useApp();
    const navigate = useNavigate();
    useLiveTime(); // re-render to update waiting time

    const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
    const canAdvance = cfg.next !== null;
    const isDelivery = order.order_type === 'delivery';

    const previewItems = (order.items ?? []).slice(0, 3);
    const moreCount = (order.items ?? []).length - 3;

    return (
        <div className={`order-card status-${order.status}`}>
            <div className="order-card-header">
                <div className="order-ticket">
                    <span className="ticket-label">#{order.ticket_number}</span>
                    <StatusBadge status={order.status} />
                </div>
                <div className="order-type-badge">
                    {isDelivery ? <Truck size={14} /> : <ShoppingBag size={14} />}
                    <span>{isDelivery ? 'Delivery' : 'Takeaway'}</span>
                </div>
            </div>

            <div className="order-card-body">
                <p className="order-customer">
                    {order.customer_name || <em>Walk-in</em>}
                    {order.phone && <span className="order-phone"> · {order.phone}</span>}
                </p>
                {isDelivery && order.address && (
                    <p className="order-address">{order.address}</p>
                )}
                <div className="order-items">
                    {previewItems.map((item, idx) => (
                        <span
                            key={`${order.id}-${item.menu_item_id ?? item.id ?? idx}-${item.item_number ?? item.item_name_snapshot}`}
                            className="order-item-pill"
                        >
                            {item.item_number && <span className="order-item-code">{item.item_number}</span>}
                            <span className="order-item-text">{item.quantity}× {item.item_name_snapshot}</span>
                        </span>
                    ))}
                    {moreCount > 0 && <span className="order-more"> +{moreCount} more</span>}
                </div>
            </div>

            <div className="order-card-times">
                <div className="time-row">
                    <Clock size={12} />
                    <span>Ordered: {formatTime(order.ordered_at)}</span>
                    {order.status === 'new' && (
                        <span className="waiting-chip">
                            {durationMinutes(order.ordered_at)} waiting
                        </span>
                    )}
                </div>
                {order.cooking_started_at && (
                    <div className="time-row">
                        <span>Cooking: {formatTime(order.cooking_started_at)}</span>
                        {order.cooking_finished_at && (
                            <span>→ Ready: {formatTime(order.cooking_finished_at)}</span>
                        )}
                    </div>
                )}
                {order.delivered_at && (
                    <div className="time-row">
                        <span>Delivered: {formatTime(order.delivered_at)}</span>
                    </div>
                )}
            </div>

            <div className="order-card-footer">
                <span className="order-total">{formatCurrency(order.total_amount)}</span>
                <div className="order-actions">
                    <button
                        className="icon-btn"
                        title="Print Receipt"
                        onClick={() => navigate(`/receipt/${order.id}`)}
                    >
                        <Printer size={15} />
                    </button>
                    {isAdmin && (
                        <>
                            <button className="icon-btn" title="Edit Order" onClick={() => onEdit(order)}>
                                <Pencil size={15} />
                            </button>
                            <button className="icon-btn danger" title="Cancel Order" onClick={() => onCancel(order)}>
                                <Ban size={15} />
                            </button>
                            <button className="icon-btn danger" title="Delete Order" onClick={() => onDelete(order)}>
                                <Trash2 size={15} />
                            </button>
                        </>
                    )}
                    {canAdvance && (
                        <button className="btn btn-sm btn-advance" onClick={() => onAdvance(order.id)}>
                            {cfg.next} <ChevronRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
