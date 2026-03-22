export const STATUS_CONFIG = {
    new: { label: 'New', color: 'var(--status-new)', bg: 'var(--status-new-bg)', glow: 'var(--status-new-glow)', next: 'Start Cooking' },
    cooking: { label: 'Cooking', color: 'var(--status-cooking)', bg: 'var(--status-cooking-bg)', glow: 'var(--status-cooking-glow)', next: 'Mark Ready' },
    ready: { label: 'Ready', color: 'var(--status-ready)', bg: 'var(--status-ready-bg)', glow: 'var(--status-ready-glow)', next: 'Mark Delivered' },
    delivered: { label: 'Delivered', color: 'var(--status-delivered)', bg: 'var(--status-delivered-bg)', glow: 'var(--status-delivered-glow)', next: null },
    cancelled: { label: 'Cancelled', color: 'var(--status-cancelled)', bg: 'var(--status-cancelled-bg)', glow: 'var(--status-cancelled-glow)', next: null },
};
