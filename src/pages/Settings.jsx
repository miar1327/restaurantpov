import { useNavigate } from 'react-router-dom';
import {
    ShieldCheck,
    User,
    Save,
    Building2,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    PencilRuler,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import DeliveryAddressComposer from '../components/DeliveryAddressComposer';
import { formatAddressParts, getRestaurantAddressContext } from '../utils/addressLookup.js';
import { normalizeEditingSettings } from '../utils/editingMode.js';

const buildSettingsForm = (settings) => {
    const location = getRestaurantAddressContext(settings);
    return {
        ...settings,
        ...normalizeEditingSettings(settings),
        location_city: settings.location_city ?? location.city,
        location_postal_code: settings.location_postal_code ?? location.postalCode,
        location_street: settings.location_street ?? location.street,
        location_house_number: settings.location_house_number ?? location.houseNumber,
        address: settings.address ?? formatAddressParts(location),
    };
};

export default function Settings() {
    const { settings, updateSettings, isAdmin, loading } = useApp();
    const { switchRole } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState(buildSettingsForm(settings));
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(buildSettingsForm(settings));
    }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const nextAddress = formatAddressParts({
                city: form.location_city,
                postalCode: form.location_postal_code,
                street: form.location_street,
                houseNumber: form.location_house_number,
            });
            const nextForm = {
                ...form,
                address: nextAddress,
            };
            await updateSettings(nextForm);
            setForm(nextForm);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="page">
                <p className="muted">Loading restaurant settings...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Restaurant configuration and live editing controls</p>
                </div>
            </div>

            <div className="settings-layout">
                <div className="settings-card">
                    <h3>Restaurant Info</h3>
                    <div className="form-group">
                        <label>Restaurant Name</label>
                        <input
                            value={form.restaurant_name ?? ''}
                            onChange={(event) => setForm({ ...form, restaurant_name: event.target.value })}
                            placeholder="My Restaurant"
                        />
                    </div>
                    {settings.address && (
                        <div className="form-group">
                            <label>Current Saved Address</label>
                            <div className="settings-address-preview">{settings.address}</div>
                        </div>
                    )}
                    <div className="form-group">
                        <label>Restaurant Address</label>
                        <DeliveryAddressComposer
                            value={form.address ?? ''}
                            onChange={(nextAddress, nextParts) => setForm((current) => ({
                                ...current,
                                address: nextAddress,
                                location_city: nextParts.city,
                                location_postal_code: nextParts.postalCode,
                                location_street: nextParts.street,
                                location_house_number: nextParts.houseNumber,
                            }))}
                            settings={form}
                            orders={[]}
                            previewLabel="Restaurant Address Preview"
                            emptyPreviewText="Start with the restaurant city, then type a PIN code or street."
                            helperNote={false}
                        />
                    </div>
                    <div className="form-group">
                        <label>Phone</label>
                        <input
                            value={form.phone ?? ''}
                            onChange={(event) => setForm({ ...form, phone: event.target.value })}
                            placeholder="+1 555-0100"
                        />
                    </div>
                    <div className="form-group">
                        <label>Default Delivery Charge (EUR)</label>
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={form.default_delivery_charge ?? 2.5}
                            onChange={(event) => setForm({
                                ...form,
                                default_delivery_charge: parseFloat(event.target.value) || 0,
                            })}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={16} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
                    </button>
                </div>

                {isAdmin && (
                    <div className="settings-card">
                        <h3>Editing Mode</h3>
                        <p className="muted">
                            Turn this on to rename pages from the component corners, reorder sidebar pages, and rearrange dashboard blocks live.
                        </p>
                        <button
                            className={`settings-toggle ${form.editing_mode_enabled ? 'on' : 'off'}`}
                            type="button"
                            onClick={() => setForm((current) => ({
                                ...current,
                                editing_mode_enabled: !current.editing_mode_enabled,
                            }))}
                        >
                            {form.editing_mode_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                            <span>{form.editing_mode_enabled ? 'Editing mode is on' : 'Editing mode is off'}</span>
                        </button>
                        <div className="settings-editing-note">
                            <PencilRuler size={16} />
                            <span>
                                When enabled, the admin can use corner tools in the Sidebar and Dashboard. Your live labels and layout are saved with the restaurant profile.
                            </span>
                        </div>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <Save size={16} /> {saving ? 'Saving...' : 'Save Editing Mode'}
                        </button>
                    </div>
                )}

                <div className="settings-card">
                    <h3>Current Role</h3>
                    <p className="muted" style={{ marginBottom: '1rem' }}>
                        Sign in with the restaurant email and master key first, then choose Admin or Waiter here with the role PIN flow.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isAdmin ? <ShieldCheck size={20} style={{ color: 'var(--accent)' }} /> : <User size={20} style={{ color: 'var(--success)' }} />}
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{isAdmin ? 'Admin' : 'Waiter'}</span>
                    </div>
                    <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={switchRole}>
                        <RefreshCw size={15} /> Switch Role
                    </button>
                    {isAdmin && (
                        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => navigate('/restaurants')}>
                            <Building2 size={15} /> Restaurant Access
                        </button>
                    )}
                </div>

                <div className="settings-card">
                    <h3>About Restaurant</h3>
                    <p className="muted">
                        A lightweight restaurant order ticket system for takeaway and delivery orders.
                        Restaurant profiles, menu data, and orders are shared through the local server for this device or network.
                    </p>
                    <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                        Version 1.0.0 · Built with React + Vite
                    </p>
                </div>
            </div>
        </div>
    );
}
