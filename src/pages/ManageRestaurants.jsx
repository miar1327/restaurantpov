import { useCallback, useEffect, useState } from 'react';
import {
    Eye,
    EyeOff,
    Pencil,
    Store,
    X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    getProfiles,
    updateProfile,
    validateEmail,
    validateMasterKey,
    validateRolePin,
} from '../utils/auth';

const emptyForm = () => ({
    name: '',
    email: '',
    address: '',
    phone: '',
    masterKey: '',
    adminPin: '',
    waiterPin: '',
    adminPinEnabled: true,
    waiterPinEnabled: true,
});

export default function ManageRestaurants() {
    const { isAdmin, restaurantId, refreshProfile } = useAuth();
    const [profiles, setProfiles] = useState([]);
    const [profilesLoading, setProfilesLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [showMasterKey, setShowMasterKey] = useState(false);
    const [showAdminPin, setShowAdminPin] = useState(false);
    const [showWaiterPin, setShowWaiterPin] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const loadProfiles = useCallback(async () => {
        setProfilesLoading(true);
        setFormError('');

        try {
            const nextProfiles = await getProfiles({ includeEmail: true });
            setProfiles(nextProfiles);
        } catch (err) {
            setFormError(err.message ?? 'Unable to load restaurant profiles.');
        } finally {
            setProfilesLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        loadProfiles();
    }, [isAdmin, loadProfiles]);

    if (!isAdmin) {
        return (
            <div className="page">
                <div className="page-header"><h1 className="page-title">Restaurant Access</h1></div>
                <p className="muted">Admin access required.</p>
            </div>
        );
    }

    const resetFormState = () => {
        setForm(emptyForm());
        setFormError('');
        setShowMasterKey(false);
        setShowAdminPin(false);
        setShowWaiterPin(false);
    };

    const startEdit = (profile) => {
        setEditingId(profile.id);
        setForm({
            name: profile.name,
            email: profile.email ?? '',
            address: profile.address ?? '',
            phone: profile.phone ?? '',
            masterKey: '',
            adminPin: '',
            waiterPin: '',
            adminPinEnabled: profile.adminPinEnabled !== false,
            waiterPinEnabled: profile.waiterPinEnabled !== false,
        });
        setFormError('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        resetFormState();
    };

    const validateForm = ({ isEdit = false }) => {
        if (!form.name.trim()) return 'Restaurant name is required.';

        const emailError = validateEmail(form.email);
        if (emailError) return emailError;

        if (!isEdit || form.masterKey) {
            const masterKeyError = validateMasterKey(form.masterKey);
            if (masterKeyError) return masterKeyError;
        }

        if (!isEdit || form.adminPin) {
            const adminPinError = validateRolePin('Admin', form.adminPin, { required: !isEdit });
            if (adminPinError) return adminPinError;
        }

        if (!isEdit || form.waiterPin) {
            const waiterPinError = validateRolePin('Waiter', form.waiterPin, { required: !isEdit });
            if (waiterPinError) return waiterPinError;
        }

        return null;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const validation = validateForm({ isEdit: true });
        if (validation) {
            setFormError(validation);
            return;
        }

        setSaving(true);
        try {
            await updateProfile(editingId, {
                name: form.name.trim(),
                email: form.email.trim(),
                address: form.address.trim(),
                phone: form.phone.trim(),
                ...(form.masterKey ? { masterKey: form.masterKey } : {}),
                ...(form.adminPin ? { adminPin: form.adminPin } : {}),
                ...(form.waiterPin ? { waiterPin: form.waiterPin } : {}),
                adminPinEnabled: form.adminPinEnabled,
                waiterPinEnabled: form.waiterPinEnabled,
            });
            await loadProfiles();
            if (editingId === restaurantId) {
                await refreshProfile();
            }
            cancelEdit();
        } catch (err) {
            setFormError(err.message ?? 'Unable to save the restaurant.');
        } finally {
            setSaving(false);
        }
    };

    const renderTextField = (label, key, placeholder = '') => (
        <div className="form-group" key={key}>
            <label className="form-label">{label}</label>
            <input
                type="text"
                className="form-input"
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
        </div>
    );

    const renderSecretField = (label, key, show, toggle, placeholder = '') => (
        <div className="form-group" key={key}>
            <label className="form-label">{label}</label>
            <div className="pw-wrap">
                <input
                    type={show ? 'text' : 'password'}
                    className="form-input"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    inputMode={key.toLowerCase().includes('pin') ? 'numeric' : undefined}
                />
                <button type="button" className="pw-toggle" onClick={toggle}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            </div>
        </div>
    );

    const renderPinToggle = (label, key) => (
        <label className="landing-toggle" key={key}>
            <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
            />
            <span>{label}</span>
        </label>
    );

    const renderForm = () => (
        <form onSubmit={handleSave} className="mr-form">
            <p className="mr-form-copy">
                You can update the email, master key, and role PIN access rules for your own restaurant profile here.
            </p>

            <div className="landing-form-grid">
                {renderTextField('Restaurant Name *', 'name', 'e.g. Spice Garden')}
                {renderTextField('Email *', 'email', 'restaurant@example.com')}
            </div>

            <div className="landing-form-grid">
                {renderTextField('Address', 'address', '123 Main Street')}
                {renderTextField('Phone', 'phone', '+1 555-0100')}
            </div>

            {renderSecretField(
                'New Master Key',
                'masterKey',
                showMasterKey,
                () => setShowMasterKey((current) => !current),
                'Leave blank to keep current',
            )}

            <div className="landing-form-grid">
                {renderSecretField(
                    'New Admin PIN',
                    'adminPin',
                    showAdminPin,
                    () => setShowAdminPin((current) => !current),
                    'Leave blank to keep current',
                )}
                {renderSecretField(
                    'New Waiter PIN',
                    'waiterPin',
                    showWaiterPin,
                    () => setShowWaiterPin((current) => !current),
                    'Leave blank to keep current',
                )}
            </div>

            <div className="landing-toggle-grid">
                {renderPinToggle('Require Admin PIN on role entry', 'adminPinEnabled')}
                {renderPinToggle('Require Waiter PIN on role entry', 'waiterPinEnabled')}
            </div>

            {formError && <p className="form-error">{formError}</p>}

            <div className="mr-form-actions">
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={cancelEdit}
                >
                    <X size={14} /> Cancel
                </button>
                <button className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Restaurant Access</h1>
                    <p className="page-subtitle">Master key, role PINs, and access rules for your restaurant</p>
                </div>
            </div>

            <p className="muted" style={{ marginBottom: '1rem' }}>
                Restaurant admins can only view and update their own restaurant profile here.
            </p>

            <div className="mr-list">
                {profilesLoading && <p className="muted">Loading restaurants...</p>}
                {!profilesLoading && profiles.length === 0 && <p className="muted">No restaurants yet.</p>}

                {profiles.map((profile) => (
                    <div key={profile.id} className={`mr-card ${profile.id === restaurantId ? 'mr-card-current' : ''}`}>
                        {editingId === profile.id ? (
                            <>
                                <h3 className="mr-card-title">Edit Restaurant Access</h3>
                                {renderForm()}
                            </>
                        ) : (
                            <div className="mr-row">
                                <div className="mr-icon"><Store size={20} /></div>
                                <div className="mr-info">
                                    <div className="mr-name">
                                        {profile.name}
                                        {profile.id === restaurantId && <span className="mr-badge-current">Current</span>}
                                    </div>
                                    {profile.email && <div className="mr-detail">{profile.email}</div>}
                                    {profile.address && <div className="mr-detail">{profile.address}</div>}
                                    {profile.phone && <div className="mr-detail">{profile.phone}</div>}
                                    <div className="mr-role-hints">
                                        <span className={`mr-role-switch ${profile.adminPinEnabled ? 'enabled' : 'disabled'}`}>
                                            Admin PIN {profile.adminPinEnabled ? 'On' : 'Off'}
                                        </span>
                                        <span className={`mr-role-switch ${profile.waiterPinEnabled ? 'enabled' : 'disabled'}`}>
                                            Waiter PIN {profile.waiterPinEnabled ? 'On' : 'Off'}
                                        </span>
                                    </div>
                                </div>
                                <div className="mr-actions">
                                    <button className="btn btn-ghost btn-icon" onClick={() => startEdit(profile)} title="Edit">
                                        <Pencil size={15} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
