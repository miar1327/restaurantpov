import { useMemo, useState } from 'react';
import {
    ArrowRight,
    Eye,
    EyeOff,
    ShieldCheck,
    Store,
    UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateRolePin } from '../utils/auth';

const ROLE_COPY = {
    admin: {
        label: 'Admin',
        description: 'Menu, settings, reports, and restaurant management',
        icon: ShieldCheck,
    },
    waiter: {
        label: 'Waiter',
        description: 'Take orders, track live tickets, and print receipts',
        icon: UserRound,
    },
};

export default function RoleAccessScreen() {
    const { profile, activateRole, logout } = useAuth();
    const [selectedRole, setSelectedRole] = useState(null);
    const [pin, setPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const roleConfig = useMemo(() => ({
        admin: profile?.adminPinEnabled !== false,
        waiter: profile?.waiterPinEnabled !== false,
    }), [profile]);

    const chooseRole = async (role) => {
        const pinRequired = roleConfig[role];
        if (!pinRequired) {
            setLoading(true);
            setError('');
            try {
                await activateRole(role);
            } catch (err) {
                setError(err.message ?? 'Unable to enter the selected role.');
            } finally {
                setLoading(false);
            }
            return;
        }

        setSelectedRole(role);
        setPin('');
        setError('');
    };

    const submitPin = async (e) => {
        e.preventDefault();
        if (!selectedRole) return;

        const validation = validateRolePin(ROLE_COPY[selectedRole].label, pin);
        if (validation) {
            setError(validation);
            return;
        }

        setLoading(true);
        setError('');
        try {
            await activateRole(selectedRole, pin);
        } catch (err) {
            setError(err.message ?? 'Unable to unlock the selected role.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="role-gate-screen">
            <div className="role-gate-card">
                <div className="role-gate-brand">
                    <div className="role-gate-badge"><Store size={20} /></div>
                    <div>
                        <p className="role-gate-kicker">Restaurant profile unlocked</p>
                        <h1 className="role-gate-title">{profile?.name ?? 'Restaurant profile'}</h1>
                        <p className="role-gate-subtitle">
                            Choose how you want to enter this restaurant.
                        </p>
                    </div>
                </div>

                <div className="role-card-grid">
                    {Object.entries(ROLE_COPY).map(([role, config]) => {
                        const Icon = config.icon;
                        const pinRequired = roleConfig[role];
                        return (
                            <button
                                key={role}
                                type="button"
                                className={`role-card ${selectedRole === role ? 'active' : ''}`}
                                onClick={() => chooseRole(role)}
                                disabled={loading}
                            >
                                <div className="role-card-head">
                                    <span className={`role-card-icon role-card-icon-${role}`}>
                                        <Icon size={18} />
                                    </span>
                                    <span className="role-card-arrow"><ArrowRight size={16} /></span>
                                </div>
                                <div className="role-card-label">{config.label}</div>
                                <div className="role-card-copy">{config.description}</div>
                                <div className="role-card-meta">
                                    {pinRequired ? 'PIN required' : 'PIN disabled for quick access'}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {selectedRole && roleConfig[selectedRole] && (
                    <form className="role-pin-form" onSubmit={submitPin}>
                        <div className="login-field">
                            <label className="login-label">
                                {ROLE_COPY[selectedRole].label} PIN
                            </label>
                            <div className="pw-wrap">
                                <input
                                    type={showPin ? 'text' : 'password'}
                                    className="login-input"
                                    inputMode="numeric"
                                    placeholder={`Enter the ${ROLE_COPY[selectedRole].label.toLowerCase()} PIN`}
                                    value={pin}
                                    onChange={(e) => {
                                        setPin(e.target.value);
                                        setError('');
                                    }}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="pw-toggle"
                                    onClick={() => setShowPin((current) => !current)}
                                >
                                    {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {error && <p className="login-error">{error}</p>}

                        <div className="role-pin-actions">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => {
                                    setSelectedRole(null);
                                    setPin('');
                                    setError('');
                                }}
                            >
                                Back
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={!pin || loading}>
                                {loading ? 'Unlocking...' : `Enter ${ROLE_COPY[selectedRole].label}`}
                            </button>
                        </div>
                    </form>
                )}

                {!selectedRole && !error && (
                    <p className="role-gate-footnote">
                        Sign in uses your restaurant email and master key first. Role PINs are checked only when enabled.
                    </p>
                )}

                <button type="button" className="role-gate-logout" onClick={logout}>
                    Use another restaurant account
                </button>
            </div>
        </div>
    );
}
