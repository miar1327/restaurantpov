import { STATUS_CONFIG } from './statusConfig';

export default function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
    return (
        <span
            className="status-badge"
            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color, boxShadow: cfg.glow }}
        >
            {cfg.label}
        </span>
    );
}
