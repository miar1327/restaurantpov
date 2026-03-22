const clean = (value = '') => String(value ?? '').trim();
const normalize = (value = '') => clean(value).toLowerCase();
const splitStreetHouseNumber = (value = '') => {
    const raw = clean(value);
    if (!raw) return { street: '', houseNumber: '' };

    const match = raw.match(/^(.*?)(?:\s+)(\d+[-a-zA-Z/]*)$/);
    if (!match) return { street: raw, houseNumber: '' };

    return {
        street: clean(match[1]),
        houseNumber: clean(match[2]),
    };
};
const splitPostalCity = (value = '') => {
    const raw = clean(value);
    const match = raw.match(/^(\d{4,5})\s+(.+)$/);
    if (!match) return null;

    return {
        postalCode: clean(match[1]),
        city: clean(match[2]),
    };
};

export const emptyAddressParts = () => ({
    city: '',
    postalCode: '',
    street: '',
    houseNumber: '',
});

export const isPostalCodeLike = (value = '') => /^\d{1,5}$/.test(clean(value));

export const formatAddressParts = (parts = {}) => (
    [clean(parts.city), clean(parts.postalCode), clean(parts.street), clean(parts.houseNumber)]
        .filter(Boolean)
        .join(', ')
);

export const parseAddressParts = (value = '', fallback = {}) => {
    const base = {
        ...emptyAddressParts(),
        ...fallback,
    };
    const raw = clean(value);

    if (!raw) return base;

    const segments = raw.split(',').map(clean).filter(Boolean);
    if (segments.length >= 4) {
        return {
            ...base,
            city: segments[0],
            postalCode: segments[1],
            street: segments[2],
            houseNumber: segments.slice(3).join(', '),
        };
    }

    if (segments.length === 3) {
        const firstPostalCity = splitPostalCity(segments[0]);
        const secondPostalCity = splitPostalCity(segments[1]);
        const thirdStreet = splitStreetHouseNumber(segments[2]);
        const firstStreet = splitStreetHouseNumber(segments[0]);

        if (secondPostalCity) {
            return {
                ...base,
                city: segments[2],
                postalCode: secondPostalCity.postalCode,
                street: firstStreet.street,
                houseNumber: firstStreet.houseNumber,
            };
        }

        if (firstPostalCity) {
            return {
                ...base,
                city: firstPostalCity.city,
                postalCode: firstPostalCity.postalCode,
                street: thirdStreet.street || segments[1],
                houseNumber: thirdStreet.houseNumber,
            };
        }

        return {
            ...base,
            city: segments[0],
            postalCode: segments[1],
            street: thirdStreet.street,
            houseNumber: thirdStreet.houseNumber,
        };
    }

    if (segments.length === 2) {
        const [first, second] = segments;
        const secondPostalCity = splitPostalCity(second);
        if (secondPostalCity) {
            const streetParts = splitStreetHouseNumber(first);
            return {
                ...base,
                city: secondPostalCity.city,
                postalCode: secondPostalCity.postalCode,
                street: streetParts.street,
                houseNumber: streetParts.houseNumber,
            };
        }

        const secondLooksPostal = /^\d{4,6}[a-zA-Z-]*$/.test(second);
        const firstLooksStreet = /\d/.test(first);

        if (secondLooksPostal) {
            return { ...base, city: base.city, postalCode: second, street: first };
        }

        if (firstLooksStreet) {
            const streetParts = splitStreetHouseNumber(first);
            return { ...base, street: streetParts.street, houseNumber: streetParts.houseNumber, city: second };
        }

        return { ...base, city: first, street: second };
    }

    const postalCity = splitPostalCity(raw);
    if (postalCity) {
        return {
            ...base,
            city: postalCity.city,
            postalCode: postalCity.postalCode,
        };
    }

    return { ...base, ...splitStreetHouseNumber(raw) };
};

export const getRestaurantAddressContext = (settings = {}) => {
    const structured = {
        city: clean(settings.location_city),
        postalCode: clean(settings.location_postal_code),
        street: clean(settings.location_street),
        houseNumber: clean(settings.location_house_number),
    };

    if (Object.values(structured).some(Boolean)) {
        return structured;
    }

    return parseAddressParts(settings.address);
};

const makeSuggestion = (parts, source) => {
    const label = formatAddressParts(parts);
    return label
        ? {
            label,
            source,
            ...emptyAddressParts(),
            ...parts,
        }
        : null;
};

export const findLocalAddressSuggestions = ({ orders = [], parts = {} }) => {
    const addressTokens = [
        normalize(parts.postalCode),
        normalize(parts.street),
        normalize(parts.houseNumber),
    ].filter(Boolean);
    const tokens = [
        normalize(parts.city),
        ...addressTokens,
    ].filter(Boolean);

    if (!normalize(parts.city) || addressTokens.length === 0) return [];

    const seen = new Set();
    const ranked = [];
    const recentOrders = [...orders].reverse();

    recentOrders.forEach((order, index) => {
        if (order?.order_type !== 'delivery' || !order?.address) return;

        const suggestion = makeSuggestion(parseAddressParts(order.address), 'recent');

        if (!suggestion || seen.has(suggestion.label)) return;
        seen.add(suggestion.label);

        if (parts.city && normalize(suggestion.city) !== normalize(parts.city)) return;

        const haystack = normalize([
            suggestion.label,
            suggestion.city,
            suggestion.postalCode,
            suggestion.street,
            suggestion.houseNumber,
        ].join(' '));
        const score = tokens.reduce((sum, token) => {
            if (!haystack.includes(token)) return sum;
            const startsStrong = [
                normalize(suggestion.city),
                normalize(suggestion.postalCode),
                normalize(suggestion.street),
                normalize(suggestion.houseNumber),
            ].some((value) => value.startsWith(token));
            return sum + (startsStrong ? 4 : 2);
        }, 0);

        if (score === 0) return;

        ranked.push({
            suggestion,
            score: score - (index * 0.01),
        });
    });

    return ranked
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((entry) => entry.suggestion);
};
