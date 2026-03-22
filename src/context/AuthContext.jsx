/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    clearRoleSelection,
    clearSession,
    getSession,
    restoreSession,
    selectRole,
    tryLogin,
} from '../utils/auth';

const AuthContext = createContext(null);

const getInitialAuthState = () => {
    const saved = getSession();
    if (!saved) {
        return { session: null, profile: null };
    }
    return {
        session: {
            token: saved.token,
            restaurantId: saved.restaurantId,
            role: saved.role ?? null,
        },
        profile: saved.profile,
    };
};

const toAuthState = (saved) => ({
    session: {
        token: saved.token,
        restaurantId: saved.restaurantId,
        role: saved.role ?? null,
    },
    profile: saved.profile,
});

export const AuthProvider = ({ children }) => {
    const [{ session, profile }, setAuthState] = useState(getInitialAuthState);
    const [loading, setLoading] = useState(() => !!getSession()?.token);

    useEffect(() => {
        let active = true;
        const saved = getSession();

        if (!saved?.token) {
            return undefined;
        }

        (async () => {
            const restored = await restoreSession();
            if (!active) return;

            if (restored) {
                setAuthState(toAuthState(restored));
            } else {
                setAuthState({ session: null, profile: null });
            }

            setLoading(false);
        })();

        return () => {
            active = false;
        };
    }, []);

    const login = useCallback(async (identifier, masterKey) => {
        const result = await tryLogin(identifier, masterKey);
        if (result.ok) {
            setAuthState({
                session: {
                    token: result.token,
                    restaurantId: result.profile.id,
                    role: result.role ?? null,
                },
                profile: result.profile,
            });
        }
        return result;
    }, []);

    const activateRole = useCallback(async (role, pin = '') => {
        const restored = await selectRole(role, pin);
        setAuthState(toAuthState(restored));
        return restored;
    }, []);

    const switchRole = useCallback(async () => {
        const restored = await clearRoleSelection();
        setAuthState(toAuthState(restored));
        return restored;
    }, []);

    const logout = useCallback(() => {
        clearSession();
        setAuthState({ session: null, profile: null });
    }, []);

    const refreshProfile = useCallback(async () => {
        if (!session?.token) return null;

        const restored = await restoreSession();
        if (restored) {
            setAuthState(toAuthState(restored));
            return restored;
        }

        return null;
    }, [session]);

    const isLoggedIn = !!session?.token;
    const restaurantId = session?.restaurantId ?? null;
    const role = session?.role ?? null;
    const hasRole = !!role;
    const isAdmin = role === 'admin';

    return (
        <AuthContext.Provider value={{
            isLoggedIn,
            loading,
            restaurantId,
            role,
            hasRole,
            isAdmin,
            profile,
            login,
            activateRole,
            switchRole,
            logout,
            refreshProfile,
        }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};
