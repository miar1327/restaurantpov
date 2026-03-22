import { useMemo } from 'react';
import { History, MapPin, Phone, UserRound } from 'lucide-react';
import { findCustomerSuggestions } from '../utils/customerMemory.js';

export default function CustomerMemoryPicker({
    orders = [],
    nameQuery = '',
    phoneQuery = '',
    onSelect,
}) {
    const suggestions = useMemo(
        () => findCustomerSuggestions(orders, { nameQuery, phoneQuery }),
        [nameQuery, orders, phoneQuery],
    );

    if (suggestions.length === 0) return null;

    return (
        <div className="customer-memory-panel">
            <div className="customer-memory-header">
                <span>Saved customer details</span>
                <small>Click once to reuse the name, phone, and saved address.</small>
            </div>
            <div className="customer-memory-list">
                {suggestions.map((customer) => (
                    <button
                        key={customer.id}
                        type="button"
                        className="customer-memory-row"
                        onClick={() => onSelect?.(customer)}
                    >
                        <div className="customer-memory-main">
                            <span className="customer-memory-name">
                                <UserRound size={14} />
                                <span>{customer.name || 'Customer without name'}</span>
                            </span>
                            {customer.phone && (
                                <span className="customer-memory-phone">
                                    <Phone size={13} />
                                    <span>{customer.phone}</span>
                                </span>
                            )}
                        </div>
                        <div className="customer-memory-meta">
                            {customer.address && (
                                <span className="customer-memory-address">
                                    <MapPin size={13} />
                                    <span>{customer.address}</span>
                                </span>
                            )}
                            <span className="customer-memory-badge">
                                <History size={12} />
                                <span>{customer.orderType === 'delivery' ? 'Delivery' : 'Takeaway'}</span>
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

