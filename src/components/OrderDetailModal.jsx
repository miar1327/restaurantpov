import { useNavigate } from 'react-router-dom';
import {
    X, Truck, ShoppingBag, Clock, Printer, ChevronRight,
    User, Phone, MapPin, FileText, Timer, Package
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { STATUS_CONFIG } from './statusConfig';
import { formatCurrency, formatDateTime, formatTime, durationMinutes } from '../utils/formatters';

export default function OrderDetailModal({ order, onClose, onAdvance, disableAdvance = false }) {
    const navigate = useNavigate();
    const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
    const canAdvance = !disableAdvance && cfg.next !== null;
    const isDelivery = order.order_type === 'delivery';
    const items = order.items ?? [];

    const subtotal = items.reduce((s, i) => s + i.line_total, 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box order-detail-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <div className="od-header-left">
                        <div className="od-ticket">
                            <span className="od-ticket-num">#{order.ticket_number}</span>
                            <StatusBadge status={order.status} />
                        </div>
                        <div className="od-type">
                            {isDelivery ? <Truck size={14} /> : <ShoppingBag size={14} />}
                            <span>{isDelivery ? 'Delivery' : 'Takeaway'}</span>
                        </div>
                    </div>
                    <div className="od-header-actions">
                        <button
                            className="btn btn-sm btn-outline"
                            onClick={() => { navigate(`/receipt/${order.id}`); onClose(); }}
                        >
                            <Printer size={14} /> Receipt
                        </button>
                        {canAdvance && (
                            <button className="btn btn-sm btn-advance" onClick={() => { onAdvance(order.id); onClose(); }}>
                                {cfg.next} <ChevronRight size={14} />
                            </button>
                        )}
                        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                    </div>
                </div>

                <div className="modal-body od-body">
                    <div className="od-columns">
                        {/* Left column */}
                        <div className="od-col">
                            {/* Customer Info */}
                            <div className="od-section">
                                <h4 className="od-section-title"><User size={13} /> Customer Details</h4>
                                <div className="od-info-grid">
                                    <span className="od-label">Name</span>
                                    <span className="od-value">{order.customer_name || <em className="muted">Walk-in</em>}</span>
                                    {order.phone && <>
                                        <span className="od-label"><Phone size={11} /> Phone</span>
                                        <span className="od-value">{order.phone}</span>
                                    </>}
                                    {isDelivery && order.address && <>
                                        <span className="od-label"><MapPin size={11} /> Address</span>
                                        <span className="od-value">{order.address}</span>
                                    </>}
                                    {order.delivery_note && <>
                                        <span className="od-label"><FileText size={11} /> Note</span>
                                        <span className="od-value">{order.delivery_note}</span>
                                    </>}
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="od-section">
                                <h4 className="od-section-title"><Clock size={13} /> Order Timeline</h4>
                                <div className="od-timeline">
                                    <TimelineStep
                                        label="Order Taken"
                                        time={order.ordered_at}
                                        active
                                        color="var(--status-new)"
                                    />
                                    <TimelineStep
                                        label="Cooking Started"
                                        time={order.cooking_started_at}
                                        active={!!order.cooking_started_at}
                                        color="var(--status-cooking)"
                                        waitFrom={order.ordered_at}
                                        waitTo={order.cooking_started_at}
                                        waitLabel="Wait to kitchen"
                                    />
                                    <TimelineStep
                                        label="Ready"
                                        time={order.cooking_finished_at}
                                        active={!!order.cooking_finished_at}
                                        color="var(--status-ready)"
                                        waitFrom={order.cooking_started_at}
                                        waitTo={order.cooking_finished_at}
                                        waitLabel="Prep time"
                                    />
                                    <TimelineStep
                                        label="Delivered"
                                        time={order.delivered_at}
                                        active={!!order.delivered_at}
                                        color="var(--status-delivered)"
                                        waitFrom={order.ordered_at}
                                        waitTo={order.delivered_at}
                                        waitLabel="Total time"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right column */}
                        <div className="od-col">
                            {/* Items */}
                            <div className="od-section">
                                <h4 className="od-section-title"><Package size={13} /> Items ({order.total_articles ?? items.reduce((s, i) => s + i.quantity, 0)})</h4>
                                <div className="od-items-list">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="od-item-row">
                                            <div className="od-item-left">
                                                <span className="od-item-qty">{item.quantity}×</span>
                                                {item.item_number && (
                                                    <span className="od-item-code">[{item.item_number}]</span>
                                                )}
                                                <div className="od-item-info">
                                                    <span className="od-item-name">{item.item_name_snapshot}</span>
                                                    {item.item_note && <span className="od-item-note">📝 {item.item_note}</span>}
                                                    {item.unit_price_override && (
                                                        <span className="od-price-override-tag">
                                                            Price overridden: {formatCurrency(item.unit_price_snapshot)} → {formatCurrency(item.final_unit_price)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="od-item-right">
                                                <span className="od-unit-price">{formatCurrency(item.final_unit_price)}</span>
                                                <span className="od-line-total">{formatCurrency(item.line_total)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="od-section">
                                <h4 className="od-section-title">💰 Bill Summary</h4>
                                <div className="od-totals">
                                    <div className="od-total-row">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    {parseFloat(order.delivery_charge) > 0 && (
                                        <div className="od-total-row">
                                            <span>Delivery Charge</span>
                                            <span>+{formatCurrency(order.delivery_charge)}</span>
                                        </div>
                                    )}
                                    {parseFloat(order.discount_amount) > 0 && (
                                        <div className="od-total-row">
                                            <span>Discount</span>
                                            <span className="discount">-{formatCurrency(order.discount_amount)}</span>
                                        </div>
                                    )}
                                    <div className="od-total-row od-grand-total">
                                        <span>Grand Total</span>
                                        <span>{formatCurrency(order.total_amount)}</span>
                                    </div>
                                    <div className="od-total-row muted">
                                        <span>Total Articles</span>
                                        <span>{order.total_articles ?? items.reduce((s, i) => s + i.quantity, 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Meta */}
                            <div className="od-section od-meta">
                                <div className="od-meta-row">
                                    <span className="od-label">Created</span>
                                    <span className="od-value">{formatDateTime(order.created_at)}</span>
                                </div>
                                <div className="od-meta-row">
                                    <span className="od-label">Last updated</span>
                                    <span className="od-value">{formatDateTime(order.updated_at)}</span>
                                </div>
                                {order.deleted_at && (
                                    <div className="od-meta-row danger-text">
                                        <span className="od-label">Cancelled/Deleted</span>
                                        <span className="od-value">{formatDateTime(order.deleted_at)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TimelineStep({ label, time, active, color, waitFrom, waitTo, waitLabel }) {
    const duration = waitFrom ? durationMinutes(waitFrom, waitTo || undefined) : null;
    return (
        <div className={`timeline-step ${active ? 'done' : 'pending'}`}>
            <div className="tl-dot" style={{ background: active ? color : 'var(--border)', borderColor: active ? color : 'var(--border)' }} />
            <div className="tl-content">
                <div className="tl-label" style={{ color: active ? color : 'var(--text-muted)' }}>{label}</div>
                <div className="tl-time">{time ? formatTime(time) : '—'}</div>
                {duration && waitTo && (
                    <div className="tl-duration">
                        <Timer size={10} /> {waitLabel}: {duration}
                    </div>
                )}
            </div>
        </div>
    );
}
