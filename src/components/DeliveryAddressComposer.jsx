import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, LoaderCircle, MapPin, Search } from 'lucide-react';
import { lookupAddressSuggestions, lookupGermanCities } from '../utils/storage.js';
import {
    findLocalAddressSuggestions,
    formatAddressParts,
    getRestaurantAddressContext,
    parseAddressParts,
} from '../utils/addressLookup.js';

const partsEqual = (left, right) => (
    left.city === right.city &&
    left.postalCode === right.postalCode &&
    left.street === right.street &&
    left.houseNumber === right.houseNumber
);

const dedupeByLabel = (entries) => {
    const seen = new Set();
    return entries.filter((entry) => {
        const label = String(entry?.label ?? '').trim().toLowerCase();
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
    });
};

export default function DeliveryAddressComposer({
    value,
    onChange,
    settings,
    orders = [],
    error = '',
    previewLabel = 'Address Preview',
    emptyPreviewText = 'Select a city, then enter a PIN code or street.',
    helperNote = '',
}) {
    const restaurantContext = useMemo(
        () => getRestaurantAddressContext(settings),
        [settings],
    );
    const [parts, setParts] = useState(() => parseAddressParts(value));
    const [citySuggestions, setCitySuggestions] = useState([]);
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [cityBusy, setCityBusy] = useState(false);
    const [addressBusy, setAddressBusy] = useState(false);
    const [cityMessage, setCityMessage] = useState('');
    const [addressMessage, setAddressMessage] = useState('');
    const lastEmittedValueRef = useRef(value ?? '');

    useEffect(() => {
        if (value === lastEmittedValueRef.current) return;
        const nextParts = parseAddressParts(value);
        setParts((current) => (partsEqual(current, nextParts) ? current : nextParts));
    }, [value]);

    const cityQuery = parts.city.trim();
    const canSearchCity = cityQuery.length >= 2;
    const canSearchAddress = cityQuery.length >= 2 && (
        parts.postalCode.trim().length >= 2 ||
        parts.street.trim().length >= 2 ||
        parts.houseNumber.trim().length >= 1
    );

    useEffect(() => {
        if (!canSearchCity) {
            setCitySuggestions([]);
            setCityBusy(false);
            setCityMessage('');
            return undefined;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            setCityBusy(true);
            setCityMessage('');

            try {
                const results = await lookupGermanCities(cityQuery, {
                    signal: controller.signal,
                });
                setCitySuggestions(results);
            } catch (err) {
                if (err.name === 'AbortError') return;
                setCitySuggestions([]);
                setCityMessage(err.message ?? 'City lookup is unavailable right now.');
            } finally {
                setCityBusy(false);
            }
        }, 220);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [canSearchCity, cityQuery]);

    const localAddressSuggestions = useMemo(
        () => findLocalAddressSuggestions({ orders, parts }),
        [orders, parts],
    );

    useEffect(() => {
        if (!canSearchAddress) {
            setAddressSuggestions([]);
            setAddressBusy(false);
            setAddressMessage('');
            return undefined;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            setAddressBusy(true);
            setAddressMessage('');

            try {
                const results = await lookupAddressSuggestions({
                    city: parts.city,
                    postalCode: parts.postalCode,
                    street: parts.street,
                    houseNumber: parts.houseNumber,
                }, {
                    signal: controller.signal,
                });
                setAddressSuggestions(results.map((entry) => ({
                    ...entry,
                    source: entry.source || 'map',
                })));
            } catch (err) {
                if (err.name === 'AbortError') return;
                setAddressSuggestions([]);
                setAddressMessage(err.message ?? 'Address lookup is unavailable right now.');
            } finally {
                setAddressBusy(false);
            }
        }, 240);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [canSearchAddress, parts.city, parts.houseNumber, parts.postalCode, parts.street]);

    const mergedAddressSuggestions = useMemo(
        () => dedupeByLabel([...localAddressSuggestions, ...addressSuggestions]).slice(0, 6),
        [localAddressSuggestions, addressSuggestions],
    );

    const formattedAddress = formatAddressParts(parts);
    const hasRestaurantAnchor = Boolean(restaurantContext.city || restaurantContext.postalCode);

    const updateParts = (nextParts) => {
        const nextValue = formatAddressParts(nextParts);
        lastEmittedValueRef.current = nextValue;
        setParts(nextParts);
        onChange(nextValue, nextParts);
    };

    const handleCityChange = (nextValue) => {
        updateParts({
            ...parts,
            city: nextValue,
        });
        setAddressSuggestions([]);
        setAddressMessage('');
    };

    const handleAddressFieldChange = (field, nextValue) => {
        updateParts({
            ...parts,
            [field]: nextValue,
        });
    };

    const applyCitySuggestion = (suggestion) => {
        updateParts({
            ...parts,
            city: suggestion.city || suggestion.label || '',
        });
        setCitySuggestions([]);
        setCityMessage('');
    };

    const applyAddressSuggestion = (suggestion) => {
        updateParts({
            city: suggestion.city || parts.city,
            postalCode: suggestion.postalCode || '',
            street: suggestion.street || '',
            houseNumber: suggestion.houseNumber || '',
        });
        setAddressSuggestions([]);
        setAddressMessage('');
    };

    return (
        <div className={`address-composer ${error ? 'has-error' : ''}`}>
            <div className="form-group">
                <label>City</label>
                <input
                    value={parts.city}
                    onChange={(event) => handleCityChange(event.target.value)}
                    placeholder={restaurantContext.city || 'Hamburg'}
                    autoComplete="address-level2"
                />
            </div>

            {(cityBusy || cityMessage || citySuggestions.length > 0) && (
                <div className="address-suggestion-panel">
                    <div className="address-suggestion-header">
                        <span>German city suggestions</span>
                        <small>Choose the delivery city first.</small>
                    </div>
                    {cityBusy && (
                        <div className="address-suggestion-empty">
                            <span className="address-status-inline">
                                <LoaderCircle size={14} className="spin" />
                                Searching cities...
                            </span>
                        </div>
                    )}
                    {!cityBusy && cityMessage && citySuggestions.length === 0 && (
                        <div className="address-suggestion-empty">{cityMessage}</div>
                    )}
                    {!cityBusy && citySuggestions.map((suggestion) => (
                        <button
                            key={`${suggestion.city}-${suggestion.postalCode || 'city'}`}
                            className="address-suggestion-row"
                            type="button"
                            onClick={() => applyCitySuggestion(suggestion)}
                        >
                            <span className="address-suggestion-label">
                                {suggestion.city}
                                {suggestion.postalCode ? ` · ${suggestion.postalCode}` : ''}
                            </span>
                            <span className="address-suggestion-source map">City</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="address-composer-grid">
                <div className="form-group">
                    <label>PIN Code</label>
                    <input
                        value={parts.postalCode}
                        onChange={(event) => handleAddressFieldChange('postalCode', event.target.value)}
                        placeholder={restaurantContext.postalCode || '20095'}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        disabled={!parts.city.trim()}
                    />
                </div>
                <div className="form-group">
                    <label>Street</label>
                    <input
                        value={parts.street}
                        onChange={(event) => handleAddressFieldChange('street', event.target.value)}
                        placeholder={restaurantContext.street || 'Mönckebergstraße'}
                        autoComplete="address-line1"
                        disabled={!parts.city.trim()}
                    />
                </div>
                <div className="form-group">
                    <label>House Number</label>
                    <input
                        value={parts.houseNumber}
                        onChange={(event) => handleAddressFieldChange('houseNumber', event.target.value)}
                        placeholder={restaurantContext.houseNumber || '7'}
                        autoComplete="address-line2"
                        disabled={!parts.city.trim()}
                    />
                </div>
                <div className="form-group">
                    <label>{previewLabel}</label>
                    <div className="settings-address-preview address-inline-preview">
                        {formattedAddress || emptyPreviewText}
                    </div>
                </div>
            </div>

            <div className="address-toolbar">
                <div className="address-preview-pill">
                    <MapPin size={14} />
                    <span>
                        {parts.city.trim()
                            ? `Searching only inside ${parts.city}.`
                            : 'Start with the delivery city.'}
                    </span>
                </div>
                <div className="address-search-status">
                    {addressBusy ? (
                        <span className="address-status-inline">
                            <LoaderCircle size={14} className="spin" />
                            Searching addresses...
                        </span>
                    ) : (
                        <span className="address-status-inline">
                            <Search size={14} />
                            City-locked suggestions
                        </span>
                    )}
                </div>
            </div>

            {!hasRestaurantAnchor && helperNote !== false && (
                <div className="address-helper-note">
                    <Building2 size={14} />
                    {helperNote || 'Add the restaurant city and PIN code in Settings for cleaner nearby delivery matches.'}
                </div>
            )}

            {!!parts.city.trim() && (addressMessage || mergedAddressSuggestions.length > 0) && (
                <div className="address-suggestion-panel">
                    <div className="address-suggestion-header">
                        <span>Address suggestions in {parts.city}</span>
                        <small>Type a PIN code or street to narrow the list.</small>
                    </div>
                    {addressMessage && mergedAddressSuggestions.length === 0 && (
                        <div className="address-suggestion-empty">{addressMessage}</div>
                    )}
                    {mergedAddressSuggestions.map((suggestion) => (
                        <button
                            key={`${suggestion.source}-${suggestion.label}`}
                            className="address-suggestion-row"
                            type="button"
                            onClick={() => applyAddressSuggestion(suggestion)}
                        >
                            <span className="address-suggestion-label">{suggestion.label}</span>
                            <span className={`address-suggestion-source ${suggestion.source === 'recent' ? 'recent' : 'map'}`}>
                                {suggestion.source === 'recent' ? 'Recent' : 'Address'}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {error && <span className="field-error">{error}</span>}
        </div>
    );
}
