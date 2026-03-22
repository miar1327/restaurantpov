import { useMemo, useState } from 'react';
import { BarChart2, TrendingUp, ShoppingBag, Truck, Package, Clock, Download, X, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatTime } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import OrderDetailModal from '../components/OrderDetailModal';
import { getBusinessDate, getOrderBusinessDate } from '../utils/storage';

const todayStr = () => getBusinessDate();
const formatReportDate = (value) =>
    new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

const shiftReportDate = (value, days) => {
    const next = new Date(`${value}T12:00:00`);
    next.setDate(next.getDate() + days);
    return getBusinessDate(next);
};

const escapeHtml = (value) =>
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

const STATUS_META = {
    new: { label: 'New', color: '#2563eb' },
    cooking: { label: 'Cooking', color: '#f59e0b' },
    ready: { label: 'Ready', color: '#16a34a' },
    delivered: { label: 'Delivered', color: '#7c3aed' },
    cancelled: { label: 'Cancelled', color: '#dc2626' },
};

const buildThermalReceiptHtml = ({
    title,
    settings,
    dateLabel,
    orders,
    summaryRows,
    footerNote = '',
    autoPrint = false,
}) => {
    const restaurantName = settings?.restaurant_name || 'Restaurant';
    const address = settings?.address || '';
    const phone = settings?.phone || '';
    const infoRows = summaryRows.filter((row) => !row.grand);
    const grandTotalRow = summaryRows.find((row) => row.grand) ?? null;
    const rows = orders.map((order) => {
        return `
            <tr>
                <td>
                    <div class="r-item-main">
                        <span class="r-item-name">#${escapeHtml(order.ticket_number)}</span>
                    </div>
                </td>
                <td class="r-right">${escapeHtml(formatCurrency(order.total_amount || 0))}</td>
            </tr>
        `;
    }).join('');
    const details = infoRows.map((row) => `
        <div class="r-row">
          <span>${escapeHtml(row.label)}:</span>
          <span class="r-val">${escapeHtml(row.value)}</span>
        </div>
    `).join('');
    const grandTotalBlock = grandTotalRow
        ? `
            <div class="r-divider">${'─'.repeat(32)}</div>
            <div class="r-total-row grand-total">
                <span>${escapeHtml(grandTotalRow.label)}</span>
                <span>${escapeHtml(grandTotalRow.value)}</span>
            </div>
        `
        : '';
    const footerBlock = footerNote ? `<p class="r-small">${escapeHtml(footerNote)}</p>` : '';
    const printScript = autoPrint ? '<script>window.onload = () => window.print();</script>' : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} Receipt</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #fff; color: #000; font-family: 'Courier New', Courier, monospace; }
    .receipt-page { min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; background: #fff; }
    .receipt-paper { background: #fff; color: #000; width: 100%; max-width: 380px; padding: 24px; border-radius: 4px; box-shadow: 0 4px 40px rgba(0,0,0,0.18); font-size: 13px; line-height: 1.5; }
    .receipt-header { text-align: center; margin-bottom: 10px; }
    .r-restaurant-name { font-size: 17px; font-weight: 700; margin-bottom: 3px; font-family: 'Courier New', monospace; }
    .r-meta { font-size: 11px; color: #000; margin: 0; }
    .r-divider { color: #000; font-size: 11px; letter-spacing: -1px; margin: 8px 0; }
    .r-info-block { display: flex; flex-direction: column; gap: 3px; margin-bottom: 4px; }
    .r-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
    .r-val { font-weight: 500; text-align: right; word-break: break-word; }
    .r-val.bold { font-weight: 700; }
    .r-items-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 4px; }
    .r-items-table th { font-weight: 700; text-align: left; padding: 3px 0; border-bottom: 1px solid #000; font-size: 11px; }
    .r-items-table td { padding: 4px 0; border-bottom: 1px dashed #000; vertical-align: top; }
    .r-th-total { text-align: right; }
    .r-right { text-align: right; }
    .r-item-main { display: flex; align-items: flex-start; gap: 8px; }
    .r-item-name { flex: 1; }
    .r-totals { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
    .r-total-row { display: flex; justify-content: space-between; font-size: 12px; }
    .r-total-row.grand-total { font-size: 15px; font-weight: 700; margin: 4px 0; }
    .r-footer { text-align: center; font-size: 11px; color: #000; padding-top: 4px; }
    .r-small { font-size: 10px; margin-top: 3px; }
    @media print {
      @page { size: 80mm auto; margin: 4mm 4mm; }
      body { background: #fff; padding: 0; color: #000; margin: 0; }
      .receipt-page { min-height: unset; display: block; background: #fff; }
      .receipt-paper {
        box-shadow: none;
        border-radius: 0;
        width: 72mm;
        max-width: 72mm;
        padding: 0;
        font-size: 11px;
        line-height: 1.4;
      }
      .r-restaurant-name { font-size: 14px; }
      .receipt-paper, .receipt-paper * {
        color: #000 !important;
        border-color: #000 !important;
        text-shadow: none !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .r-meta, .r-row, .r-items-table, .r-items-table th, .r-items-table td, .r-footer, .r-small, .r-total-row { font-size: 10px; }
      .r-divider { font-size: 10px; overflow: hidden; }
      .r-total-row.grand-total { font-size: 13px; }
    }
  </style>
</head>
<body>
  <div class="receipt-page">
    <div class="receipt-paper">
      <div class="receipt-header">
        <h1 class="r-restaurant-name">${escapeHtml(restaurantName)}</h1>
        ${address ? `<p class="r-meta">${escapeHtml(address)}</p>` : ''}
        ${phone ? `<p class="r-meta">${escapeHtml(phone)}</p>` : ''}
      </div>
      <div class="r-divider">${'─'.repeat(32)}</div>
      <div class="r-info-block">
        <div class="r-row"><span>Receipt Type:</span><span class="r-val bold">Daily Report</span></div>
        <div class="r-row"><span>Report:</span><span class="r-val">${escapeHtml(title)}</span></div>
        <div class="r-row"><span>Date/Time:</span><span class="r-val">${escapeHtml(dateLabel)}</span></div>
        ${details}
        <div class="r-row"><span>Generated:</span><span class="r-val">${escapeHtml(new Date().toLocaleString('en-GB'))}</span></div>
      </div>
      <div class="r-divider">${'─'.repeat(32)}</div>
      <table class="r-items-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th class="r-th-total">Amount</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="2">No orders found.</td></tr>'}</tbody>
      </table>
      <div class="r-totals">
        ${grandTotalBlock}
      </div>
      <div class="r-divider">${'─'.repeat(32)}</div>
      <div class="r-footer">
        <p>Daily Report Receipt</p>
        ${footerBlock}
      </div>
    </div>
  </div>
  ${printScript}
</body>
</html>`;
};

const buildDrilldownReceiptHtml = ({ title, settings, dateLabel, orders, summaryLabel, summaryValue }) =>
    buildThermalReceiptHtml({
        title,
        settings,
        dateLabel,
        orders,
        summaryRows: [
            { label: 'Orders', value: String(orders.length) },
            { label: summaryLabel, value: summaryValue, grand: true },
        ],
        footerNote: 'Print directly to the thermal printer or save as PDF.',
        autoPrint: true,
    });

export default function Reports() {
    const { orders, settings, loading } = useApp();
    const [selectedDate, setSelectedDate] = useState(todayStr());
    const [drilldown, setDrilldown] = useState(null);
    const [detailOrder, setDetailOrder] = useState(null);

    // Filter orders for selected date
    const datedOrders = useMemo(
        () => orders.filter((o) => getOrderBusinessDate(o) === selectedDate),
        [orders, selectedDate],
    );
    const dayOrders = useMemo(
        () => datedOrders.filter((o) => o.status !== 'cancelled'),
        [datedOrders],
    );

    const deliveredOrders = dayOrders.filter((o) => o.status === 'delivered');
    const takeawayOrders = deliveredOrders.filter((o) => o.order_type === 'takeaway');
    const deliveryOrders = deliveredOrders.filter((o) => o.order_type === 'delivery');
    const cancelledOrders = datedOrders.filter((o) => o.status === 'cancelled');
    const prettyDateLabel = formatReportDate(selectedDate);

    // Revenue calculations
    const totalRevenue = deliveredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const takeawayRevenue = takeawayOrders
        .reduce((s, o) => s + (o.total_amount || 0), 0);
    const deliveryRevenue = deliveryOrders
        .reduce((s, o) => s + (o.total_amount || 0), 0);
    const deliveryChargeTotal = deliveredOrders.reduce((s, o) => s + (o.delivery_charge || 0), 0);

    const totalArticles = deliveredOrders.reduce((s, o) => s + (o.total_articles || 0), 0);
    const avgOrderValue = deliveredOrders.length ? totalRevenue / deliveredOrders.length : 0;

    // Status breakdown for ALL orders today
    const statusCounts = { new: 0, cooking: 0, ready: 0, delivered: 0, cancelled: 0 };
    datedOrders.forEach(o => {
        if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
    });

    // Top items (from delivered + active)
    const itemMap = {};
    dayOrders.forEach((o) => {
        (o.items ?? []).forEach((item) => {
            const key = item.item_name_snapshot;
            if (!itemMap[key]) itemMap[key] = { name: key, code: item.item_number ?? '', qty: 0, revenue: 0 };
            itemMap[key].qty += item.quantity;
            itemMap[key].revenue += item.line_total;
        });
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

    // Avg prep time for delivered orders
    const prepTimes = deliveredOrders
        .filter(o => o.cooking_started_at && o.cooking_finished_at)
        .map(o => (new Date(o.cooking_finished_at) - new Date(o.cooking_started_at)) / 60000);
    const avgPrepTime = prepTimes.length ? Math.round(prepTimes.reduce((s, t) => s + t, 0) / prepTimes.length) : null;

    const avgTotalTime = (() => {
        const times = deliveredOrders
            .filter(o => o.ordered_at && o.delivered_at)
            .map(o => (new Date(o.delivered_at) - new Date(o.ordered_at)) / 60000);
        return times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;
    })();

    const openDrilldown = ({ title, orders: drilldownOrders, accentColor, summaryLabel, summaryValue, description, fileSlug }) => {
        setDrilldown({
            title,
            orders: drilldownOrders,
            accentColor,
            summaryLabel,
            summaryValue,
            description,
            fileSlug,
        });
    };

    const openStatusDrilldown = (status) => {
        const meta = STATUS_META[status];
        const filteredOrders = datedOrders.filter((order) => order.status === status);
        openDrilldown({
            title: `${meta.label} Orders`,
            orders: filteredOrders,
            accentColor: meta.color,
            summaryLabel: `${meta.label} Orders`,
            summaryValue:
                status === 'cancelled'
                    ? `${filteredOrders.length} cancelled · ${formatCurrency(filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0))}`
                    : `${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}`,
            description:
                status === 'cancelled'
                    ? 'Orders cancelled on this business day.'
                    : `${meta.label} orders for ${prettyDateLabel}.`,
            fileSlug: `${status}-orders`,
        });
    };

    const printDrilldownReceipt = (panel) => {
        if (!panel) return;

        const html = buildDrilldownReceiptHtml({
            title: panel.title,
            settings,
            dateLabel: prettyDateLabel,
            orders: panel.orders,
            summaryLabel: panel.summaryLabel,
            summaryValue: panel.summaryValue,
        });

        const win = window.open('', '_blank');
        if (!win) {
            alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
            return;
        }
        win.document.write(html);
        win.document.close();
    };

    // ── CSV Export ─────────────────────────────────────────────
    const downloadCSV = () => {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [];

        // Summary
        rows.push(['DAILY REPORT', selectedDate]);
        rows.push([]);
        rows.push(['SUMMARY']);
        rows.push(['Total Revenue', formatCurrency(totalRevenue)]);
        rows.push(['Completed Orders', deliveredOrders.length]);
        rows.push(['Total Articles Sold', totalArticles]);
        rows.push(['Avg Order Value', formatCurrency(avgOrderValue)]);
        rows.push(['Takeaway Revenue', formatCurrency(takeawayRevenue)]);
        rows.push(['Delivery Revenue', formatCurrency(deliveryRevenue)]);
        rows.push(['Delivery Charges', formatCurrency(deliveryChargeTotal)]);
        rows.push(['Avg Prep Time (min)', avgPrepTime ?? '-']);
        rows.push(['Avg Total Time (min)', avgTotalTime ?? '-']);
        rows.push([]);

        // Completed orders
        rows.push(['COMPLETED ORDERS']);
        rows.push(['Ticket #', 'Type', 'Customer', 'Phone', 'Ordered At', 'Delivered At', 'Prep (min)', 'Total (min)', 'Items', 'Subtotal', 'Delivery Charge', 'Discount', 'Grand Total']);
        deliveredOrders.forEach((o) => {
            const prepMins = o.cooking_started_at && o.cooking_finished_at
                ? Math.round((new Date(o.cooking_finished_at) - new Date(o.cooking_started_at)) / 60000) : '';
            const totalMins = o.ordered_at && o.delivered_at
                ? Math.round((new Date(o.delivered_at) - new Date(o.ordered_at)) / 60000) : '';
            const itemsStr = (o.items ?? [])
                .map(i => `${i.quantity}x [${i.item_number ?? ''}] ${i.item_name_snapshot} @${parseFloat(i.final_unit_price).toFixed(2)}`)
                .join(' | ');
            const subtotal = (o.items ?? []).reduce((s, i) => s + i.line_total, 0);
            rows.push([
                o.ticket_number, o.order_type, o.customer_name || 'Walk-in',
                o.phone || '', o.ordered_at || '', o.delivered_at || '',
                prepMins, totalMins, itemsStr,
                subtotal.toFixed(2), parseFloat(o.delivery_charge || 0).toFixed(2),
                parseFloat(o.discount_amount || 0).toFixed(2), parseFloat(o.total_amount || 0).toFixed(2),
            ]);
        });
        rows.push([]);

        // Top items
        rows.push(['TOP ITEMS']);
        rows.push(['Rank', 'Code', 'Item', 'Qty Sold', 'Revenue']);
        topItems.forEach((item, idx) => {
            rows.push([idx + 1, item.code, item.name, item.qty, item.revenue.toFixed(2)]);
        });

        const csv = rows.map(r => r.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${selectedDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── PDF Export ────────────────────────────────────────────
    const downloadPDF = () => {
        const prettyDate = new Date(`${selectedDate}T12:00:00`)
            .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const html = buildThermalReceiptHtml({
            title: 'Daily Report',
            settings,
            dateLabel: prettyDate,
            orders: deliveredOrders,
            summaryRows: [
                { label: 'Completed Orders', value: String(deliveredOrders.length) },
                { label: 'Takeaway Revenue', value: formatCurrency(takeawayRevenue) },
                { label: 'Delivery Revenue', value: formatCurrency(deliveryRevenue) },
                { label: 'Cancelled Orders', value: String(cancelledOrders.length) },
                { label: 'Avg Prep Time', value: avgPrepTime !== null ? `${avgPrepTime} min` : '—' },
                { label: 'Avg Total Time', value: avgTotalTime !== null ? `${avgTotalTime} min` : '—' },
                { label: 'Total Revenue', value: formatCurrency(totalRevenue), grand: true },
            ],
            footerNote: 'Each line shows order number and amount only.',
            autoPrint: true,
        });

        const win = window.open('', '_blank');
        if (!win) { alert('Pop-up blocked! Please allow pop-ups for this site and try again.'); return; }
        win.document.write(html);
        win.document.close();
    };


    if (loading) {
        return (
            <div className="page">
                <p className="muted">Loading reports...</p>
            </div>
        );
    }

    return (

        <div className="page reports-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Daily Reports</h1>
                    <p className="page-subtitle">Revenue &amp; order insights</p>
                </div>
                <div className="report-header-actions">
                    <div className="report-date-card">
                        <div className="report-date-icon">
                            <CalendarDays size={18} />
                        </div>
                        <div className="report-date-copy">
                            <span className="report-date-kicker">Business Day</span>
                            <strong>{prettyDateLabel}</strong>
                        </div>
                        <div className="report-date-controls">
                            <button
                                className="report-date-step"
                                onClick={() => setSelectedDate(shiftReportDate(selectedDate, -1))}
                                title="Previous day"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <input
                                type="date"
                                className="date-picker-input"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={todayStr()}
                            />
                            <button
                                className="report-date-step"
                                onClick={() => setSelectedDate(shiftReportDate(selectedDate, 1))}
                                title="Next day"
                                disabled={selectedDate === todayStr()}
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                className="report-date-today"
                                onClick={() => setSelectedDate(todayStr())}
                                disabled={selectedDate === todayStr()}
                            >
                                Today
                            </button>
                        </div>
                    </div>
                    <button
                        className="btn btn-outline btn-download"
                        onClick={downloadCSV}
                        title={`Download report for ${selectedDate} as CSV`}
                    >
                        <Download size={15} /> CSV
                    </button>
                    <button
                        className="btn btn-outline btn-download-pdf"
                        onClick={downloadPDF}
                        title={`Download report for ${selectedDate} as PDF`}
                    >
                        <Download size={15} /> Print / PDF
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <KpiCard
                    icon={<TrendingUp size={20} />}
                    label="Total Revenue"
                    value={formatCurrency(totalRevenue)}
                    sub={`${deliveredOrders.length} completed order${deliveredOrders.length !== 1 ? 's' : ''}`}
                    color="#16a34a"
                    onClick={() =>
                        openDrilldown({
                            title: 'Total Revenue',
                            orders: deliveredOrders,
                            accentColor: '#16a34a',
                            summaryLabel: 'Total Revenue',
                            summaryValue: formatCurrency(totalRevenue),
                            description: `Delivered orders contributing to revenue on ${prettyDateLabel}.`,
                            fileSlug: 'total-revenue',
                        })
                    }
                />
                <KpiCard
                    icon={<Package size={20} />}
                    label="Total Articles Sold"
                    value={totalArticles}
                    sub={`Avg ${formatCurrency(avgOrderValue)} per order`}
                    color="#0891b2"
                />
                <KpiCard
                    icon={<ShoppingBag size={20} />}
                    label="Takeaway Revenue"
                    value={formatCurrency(takeawayRevenue)}
                    sub={`${takeawayOrders.length} orders`}
                    color="#f59e0b"
                    onClick={() =>
                        openDrilldown({
                            title: 'Takeaway Revenue',
                            orders: takeawayOrders,
                            accentColor: '#f59e0b',
                            summaryLabel: 'Takeaway Revenue',
                            summaryValue: formatCurrency(takeawayRevenue),
                            description: `Completed takeaway orders for ${prettyDateLabel}.`,
                            fileSlug: 'takeaway-revenue',
                        })
                    }
                />
                <KpiCard
                    icon={<Truck size={20} />}
                    label="Delivery Revenue"
                    value={formatCurrency(deliveryRevenue)}
                    sub={`+${formatCurrency(deliveryChargeTotal)} delivery charges`}
                    color="#7c3aed"
                    onClick={() =>
                        openDrilldown({
                            title: 'Delivery Revenue',
                            orders: deliveryOrders,
                            accentColor: '#7c3aed',
                            summaryLabel: 'Delivery Revenue',
                            summaryValue: formatCurrency(deliveryRevenue),
                            description: `Completed delivery orders for ${prettyDateLabel}.`,
                            fileSlug: 'delivery-revenue',
                        })
                    }
                />
                <KpiCard
                    icon={<Clock size={20} />}
                    label="Avg Prep Time"
                    value={avgPrepTime !== null ? `${avgPrepTime} min` : '—'}
                    sub="Kitchen to ready"
                    color="#0f766e"
                />
                <KpiCard
                    icon={<BarChart2 size={20} />}
                    label="Avg Total Time"
                    value={avgTotalTime !== null ? `${avgTotalTime} min` : '—'}
                    sub="Order to delivered"
                    color="#2563eb"
                />
            </div>

            <div className="reports-columns">
                {/* Status Breakdown */}
                <div className="report-card report-card-status">
                    <h3 className="report-card-title">Orders by Status — Today</h3>
                    <div className="status-breakdown">
                        {Object.entries(statusCounts).map(([status, count]) => (
                            <button
                                key={status}
                                type="button"
                                className={`sb-row sb-row-button sb-row-${status}`}
                                onClick={() => openStatusDrilldown(status)}
                            >
                                <StatusBadge status={status} />
                                <div className="sb-bar-wrap">
                                    <div
                                        className="sb-bar"
                                        style={{
                                            width: `${Math.max(4, (count / Math.max(1, Object.values(statusCounts).reduce((a, b) => a + b, 0))) * 100)}%`,
                                            background: `var(--status-${status})`,
                                            opacity: 0.75,
                                        }}
                                    />
                                </div>
                                <span className="sb-count">{count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top Selling Items */}
                <div className="report-card report-card-top-items">
                    <h3 className="report-card-title">Top Selling Items — Today</h3>
                    {topItems.length === 0 ? (
                        <p className="muted" style={{ padding: '16px 0', fontSize: '0.88rem' }}>No orders yet today.</p>
                    ) : (
                        <div className="top-items-list">
                            {topItems.map((item, idx) => (
                                <div key={item.name} className="top-item-row">
                                    <span className="top-item-rank">#{idx + 1}</span>
                                    {item.code && <span className="top-item-code">[{item.code}]</span>}
                                    <span className="top-item-name">{item.name}</span>
                                    <span className="top-item-qty">{item.qty}× sold</span>
                                    <span className="top-item-rev">{formatCurrency(item.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Delivered Orders Table */}
            <div className="report-card report-card-full report-card-revenue">
                <h3 className="report-card-title">
                    Completed Orders — {prettyDateLabel}
                </h3>
                {deliveredOrders.length === 0 ? (
                    <p className="muted" style={{ padding: '20px 0', fontSize: '0.88rem' }}>No completed orders for this date.</p>
                ) : (
                    <div className="delivered-table-wrap">
                        <table className="delivered-table">
                            <thead>
                                <tr>
                                    <th>Ticket #</th>
                                    <th>Type</th>
                                    <th>Customer</th>
                                    <th>Items</th>
                                    <th>Ordered</th>
                                    <th>Delivered</th>
                                    <th>Prep Time</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deliveredOrders.map((o) => {
                                    const prepMins = o.cooking_started_at && o.cooking_finished_at
                                        ? Math.round((new Date(o.cooking_finished_at) - new Date(o.cooking_started_at)) / 60000)
                                        : null;
                                    const totalMins = o.ordered_at && o.delivered_at
                                        ? Math.round((new Date(o.delivered_at) - new Date(o.ordered_at)) / 60000)
                                        : null;
                                    return (
                                        <tr key={o.id} className={`report-order-row report-order-row-${o.order_type}`}>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="report-order-trigger"
                                                    onClick={() => setDetailOrder(o)}
                                                >
                                                    #{o.ticket_number}
                                                </button>
                                            </td>
                                            <td>
                                                <span className={`type-chip type-chip-${o.order_type}`}>
                                                    {o.order_type === 'delivery' ? '🚗' : '🥡'}
                                                </span>
                                            </td>
                                            <td>{o.customer_name || <em className="muted">Walk-in</em>}</td>
                                            <td className="items-cell">
                                                <div className="report-items-list">
                                                    {(o.items ?? []).map((item, idx) => (
                                                        <span
                                                            key={`${o.id}-${item.menu_item_id ?? item.id ?? idx}-${item.item_number ?? item.item_name_snapshot}`}
                                                            className="order-item-pill report-item-pill"
                                                        >
                                                            {item.item_number && <span className="order-item-code">{item.item_number}</span>}
                                                            <span className="order-item-text">{item.quantity}× {item.item_name_snapshot}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>{formatTime(o.ordered_at)}</td>
                                            <td>{formatTime(o.delivered_at)}</td>
                                            <td>{prepMins !== null ? `${prepMins}m` : '—'}<span className="muted"> / {totalMins !== null ? `${totalMins}m` : '—'}</span></td>
                                            <td className="revenue-cell">{formatCurrency(o.total_amount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="7" className="tfoot-label">Total Revenue</td>
                                    <td className="revenue-cell tfoot-total">
                                        <button
                                            type="button"
                                            className="report-total-trigger"
                                            onClick={() =>
                                                openDrilldown({
                                                    title: 'Total Revenue',
                                                    orders: deliveredOrders,
                                                    accentColor: '#16a34a',
                                                    summaryLabel: 'Total Revenue',
                                                    summaryValue: formatCurrency(totalRevenue),
                                                    description: `Delivered orders contributing to revenue on ${prettyDateLabel}.`,
                                                    fileSlug: 'total-revenue',
                                                })
                                            }
                                        >
                                            {formatCurrency(totalRevenue)}
                                        </button>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {drilldown && (
                <ReportDrilldownModal
                    panel={drilldown}
                    onClose={() => setDrilldown(null)}
                    onDownload={() => printDrilldownReceipt(drilldown)}
                    onSelectOrder={(order) => setDetailOrder(order)}
                />
            )}

            {detailOrder && (
                <OrderDetailModal
                    order={detailOrder}
                    onClose={() => setDetailOrder(null)}
                    onAdvance={() => {}}
                    disableAdvance
                />
            )}
        </div>
    );
}

function KpiCard({ icon, label, value, sub, color, onClick = null }) {
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            className={`kpi-card ${onClick ? 'clickable' : ''}`}
            style={{
                borderColor: color,
                boxShadow: `0 0 0 1px ${color}22`,
            }}
            {...(onClick ? { type: 'button', onClick } : {})}
        >
            <div className="kpi-icon" style={{ color, background: `${color}18`, border: `1px solid ${color}2f` }}>{icon}</div>
            <div className="kpi-body">
                <div className="kpi-label" style={{ color, opacity: 0.84 }}>{label}</div>
                <div className="kpi-value" style={{ color }}>{value}</div>
                <div className="kpi-sub" style={{ color, opacity: 0.74 }}>{sub}</div>
            </div>
        </Component>
    );
}

function ReportDrilldownModal({ panel, onClose, onDownload, onSelectOrder }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box report-drilldown-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header report-drilldown-header" style={{ borderBottomColor: `${panel.accentColor}33` }}>
                    <div>
                        <p className="report-drilldown-kicker" style={{ color: panel.accentColor }}>Report Drilldown</p>
                        <h2 className="report-drilldown-title" style={{ color: panel.accentColor }}>{panel.title}</h2>
                    </div>
                    <button className="icon-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-body">
                    <div
                        className="report-drilldown-summary"
                        style={{
                            borderColor: panel.accentColor,
                            boxShadow: `0 0 0 1px ${panel.accentColor}22`,
                        }}
                    >
                        <div className="report-drilldown-summary-label" style={{ color: panel.accentColor }}>
                            {panel.summaryLabel}
                        </div>
                        <div className="report-drilldown-summary-value" style={{ color: panel.accentColor }}>
                            {panel.summaryValue}
                        </div>
                        <div className="report-drilldown-summary-copy">{panel.description}</div>
                    </div>

                    {panel.orders.length === 0 ? (
                        <p className="muted" style={{ fontSize: '0.9rem' }}>No orders matched this filter.</p>
                    ) : (
                        <div className="report-drilldown-list">
                            {panel.orders.map((order) => (
                                <div
                                    key={order.id}
                                    className={`report-drilldown-row report-drilldown-row-${order.status} report-drilldown-row-simple`}
                                    style={{ borderLeftColor: panel.accentColor }}
                                >
                                    <button
                                        type="button"
                                        className="report-order-trigger report-order-trigger-inline"
                                        onClick={() => onSelectOrder(order)}
                                    >
                                        #{order.ticket_number}
                                    </button>
                                    <span className="report-drilldown-amount" style={{ color: panel.accentColor }}>
                                        {formatCurrency(order.total_amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose}>Close</button>
                    <button className="btn btn-outline" onClick={onDownload}>
                        <Download size={15} /> Print Receipt / PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
