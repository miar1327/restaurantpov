const clean = (value = '') => String(value ?? '').trim();
const normalizeText = (value = '') => clean(value).toLowerCase();
const normalizePhone = (value = '') => clean(value).replace(/\D+/g, '');

export const buildCustomerMemory = (orders = []) => {
    const seen = new Set();
    const records = [];

    [...orders].reverse().forEach((order) => {
        if (!order || order.deleted_at) return;

        const name = clean(order.customer_name);
        const phone = clean(order.phone);
        const address = clean(order.address);

        if (!name && !phone) return;

        const key = normalizePhone(phone) || `${normalizeText(name)}|${normalizeText(address)}`;
        if (!key || seen.has(key)) return;

        seen.add(key);
        records.push({
            id: key,
            name,
            phone,
            address,
            orderType: clean(order.order_type) || 'takeaway',
            orderedAt: order.ordered_at || order.updated_at || order.created_at || '',
        });
    });

    return records;
};

export const findCustomerSuggestions = (orders = [], { nameQuery = '', phoneQuery = '' } = {}) => {
    const normalizedNameQuery = normalizeText(nameQuery);
    const normalizedPhoneQuery = normalizePhone(phoneQuery);

    if (normalizedNameQuery.length < 2 && normalizedPhoneQuery.length < 2) {
        return [];
    }

    return buildCustomerMemory(orders)
        .map((record, index) => {
            const normalizedName = normalizeText(record.name);
            const normalizedPhone = normalizePhone(record.phone);

            let score = 0;

            if (normalizedNameQuery) {
                if (normalizedName.startsWith(normalizedNameQuery)) score += 12;
                else if (normalizedName.includes(normalizedNameQuery)) score += 6;
            }

            if (normalizedPhoneQuery) {
                if (normalizedPhone.startsWith(normalizedPhoneQuery)) score += 14;
                else if (normalizedPhone.includes(normalizedPhoneQuery)) score += 7;
            }

            if (normalizedNameQuery && normalizedPhoneQuery && score > 0) {
                score += 3;
            }

            if (score === 0) return null;

            return {
                ...record,
                score: score - (index * 0.01),
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score)
        .slice(0, 6);
};

