import { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
// eslint-disable-next-line no-unused-vars
import { animated, useSpring, useTrail } from '@react-spring/web';
import { animate, stagger } from 'animejs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import {
    ArrowRight,
    BadgeCheck,
    CircleDollarSign,
    Clock3,
    Eye,
    EyeOff,
    KeyRound,
    Menu,
    Mail,
    MapPin,
    Phone,
    Plus,
    ReceiptText,
    ShieldCheck,
    Store,
    Ticket,
    Truck,
    X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Velocity from 'velocity-animate';
import HeroThreeBackdrop from '../components/landing/HeroThreeBackdrop';
import {
    createProfile,
    requestPasswordReset,
    resetPasswordWithCode,
    validateEmail,
    validateMasterKey,
    validateRolePin,
} from '../utils/auth';

const emptyRestaurantForm = () => ({
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

const emptyResetRequestForm = () => ({ email: '' });
const emptyResetConfirmForm = () => ({ email: '', code: '', masterKey: '', adminPin: '', waiterPin: '' });

const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'Demo', href: '#demo' },
    { label: 'Features', href: '#features' },
    { label: 'Services', href: '#services' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Contact', href: '#contact' },
];

const heroChips = [
    { label: 'Takeaway', icon: Store },
    { label: 'Delivery', icon: Truck },
    { label: 'Ticket Numbers', icon: Ticket },
    { label: 'Receipts', icon: ReceiptText },
    { label: 'Menu Control', icon: CircleDollarSign },
];

const workflowSteps = [
    {
        number: '01',
        title: 'Take the order',
        description: 'Staff create orders quickly using menu items, categories, and assigned item numbers.',
    },
    {
        number: '02',
        title: 'Track every ticket',
        description: 'The dashboard records ticket number, status, timing, and queue visibility in one place.',
    },
    {
        number: '03',
        title: 'Complete and print',
        description: 'Finalize the order, update delivery progress, and print a clean receipt with totals.',
    },
];

const featureCards = [
    {
        icon: Ticket,
        title: 'Smart Tickets',
        description: 'Generate serial order numbers and keep every takeaway or delivery request organized.',
    },
    {
        icon: Clock3,
        title: 'Live Order Tracking',
        description: 'Track ordered, cooking, ready, and delivered states in one clear queue.',
    },
    {
        icon: ReceiptText,
        title: 'Receipt Ready',
        description: 'Print simple, accurate receipts with items, quantities, totals, and timestamps.',
    },
    {
        icon: CircleDollarSign,
        title: 'Menu Control',
        description: 'Manage menu categories, item numbers, and pricing from one operational workspace.',
    },
    {
        icon: ShieldCheck,
        title: 'Admin Editing',
        description: 'Admins can edit taken orders, cancel mistakes, and adjust line-item pricing safely.',
    },
    {
        icon: Truck,
        title: 'Delivery Workflow',
        description: 'Keep delivery preparation and handoff aligned with timestamps and status updates.',
    },
];

const serviceCards = [
    {
        title: 'Onboarding and setup support',
        description: 'Get your restaurant profile, operational rules, and daily flow configured quickly.',
    },
    {
        title: 'Dashboard customization',
        description: 'Adjust core views for service style, queue preference, and shift-level visibility.',
    },
    {
        title: 'Menu management assistance',
        description: 'Maintain categories, item numbers, and pricing structure for stable order entry.',
    },
    {
        title: 'Staff and admin access control',
        description: 'Apply role-specific controls and protect sensitive actions with admin authority.',
    },
    {
        title: 'Demo and team enablement',
        description: 'Run guided walkthroughs so teams are productive from day one on live service.',
    },
];

const pricingPlans = [
    {
        name: 'Starter',
        price: 'EUR 39',
        period: '/month',
        summary: 'For single-location restaurants beginning digital order operations.',
        cta: 'Start Starter',
        highlights: [
            'Up to 2 staff accounts',
            'Ticket numbering and receipt printing',
            'Daily reports and email reset flow',
        ],
    },
    {
        name: 'Business',
        price: 'EUR 99',
        period: '/month',
        summary: 'For active takeaway and delivery teams needing tighter daily control.',
        featured: true,
        cta: 'Choose Business',
        highlights: [
            'Unlimited staff and waiter/admin roles',
            'Advanced order edits and override controls',
            'Priority onboarding and workflow tuning',
        ],
    },
    {
        name: 'Custom',
        price: 'Let’s talk',
        period: '',
        summary: 'For restaurants needing tailored workflow rules, rollout support, and scaling guidance.',
        cta: 'Talk to Sales',
        highlights: [
            'Multi-location deployment',
            'Custom process and reporting setup',
            'Dedicated implementation support',
        ],
    },
];

const demoCards = [
    {
        icon: Ticket,
        title: 'Order queue control',
        description: 'See every ticket from new to delivered with timestamps and clear kitchen handoff.',
    },
    {
        icon: ReceiptText,
        title: 'Thermal-ready receipts',
        description: 'Print clean receipts with item numbers, quantities, totals, and order references.',
    },
    {
        icon: ShieldCheck,
        title: 'Role-based safety',
        description: 'Admins handle sensitive edits while staff keeps service moving without bottlenecks.',
    },
];

const sectionMotion = {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.5, ease: 'easeOut' },
};

const USE_SIMPLE_LOGIN_LAYOUT = true;

function AuthField({ label, icon: Icon, children, inputId }) {
    return (
        <div className="space-y-2">
            <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
                {Icon ? <Icon size={16} className="text-[#2563eb]" /> : null}
                {label}
            </label>
            {children}
        </div>
    );
}

function inputClass(hasError = false) {
    return ['rpv-input', hasError ? 'rpv-input-error' : ''].join(' ').trim();
}

function renderAuthTitle(mode) {
    if (mode === 'create') return 'Create restaurant account';
    if (mode.startsWith('reset')) return 'Reset restaurant access';
    return 'Welcome back';
}

function renderAuthSubtitle(mode) {
    if (mode === 'create') {
        return 'Create a restaurant profile with one master key and separate PIN controls for staff and admin.';
    }
    if (mode.startsWith('reset')) {
        return 'Request a secure email code and restore your restaurant access.';
    }
    return 'Sign in to access your restaurant dashboard.';
}

export default function LoginScreen() {
    const { login } = useAuth();

    const [mode, setMode] = useState('login');
    const [notice, setNotice] = useState('');
    const [keepSignedIn, setKeepSignedIn] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [email, setEmail] = useState('');
    const [masterKey, setMasterKey] = useState('');
    const [showMasterKey, setShowMasterKey] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

    const [form, setForm] = useState(emptyRestaurantForm());
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState('');
    const [showCreateMaster, setShowCreateMaster] = useState(false);
    const [showAdminPin, setShowAdminPin] = useState(false);
    const [showWaiterPin, setShowWaiterPin] = useState(false);

    const [resetRequestForm, setResetRequestForm] = useState(emptyResetRequestForm());
    const [resetConfirmForm, setResetConfirmForm] = useState(emptyResetConfirmForm());
    const [resetting, setResetting] = useState(false);
    const [resetError, setResetError] = useState('');
    const [showResetMaster, setShowResetMaster] = useState(false);
    const [showResetAdminPin, setShowResetAdminPin] = useState(false);
    const [showResetWaiterPin, setShowResetWaiterPin] = useState(false);
    const landingRootRef = useRef(null);
    const accessCardRef = useRef(null);

    const heroCardFloat = useSpring({
        from: { y: 0 },
        to: { y: -9 },
        loop: { reverse: true },
        config: { duration: 3200 },
    });

    const chipTrail = useTrail(heroChips.length, {
        from: { opacity: 0, y: 12 },
        to: { opacity: 1, y: 0 },
        config: { mass: 1, tension: 190, friction: 20 },
        delay: 140,
    });

    useEffect(() => {
        if (USE_SIMPLE_LOGIN_LAYOUT) return undefined;
        gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

        const context = gsap.context(() => {
            const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

            heroTimeline
                .from('.rpv-hero-bg-word', {
                    opacity: 0,
                    y: 24,
                    duration: 0.9,
                    stagger: 0.09,
                })
                .from(
                    '.rpv-hero-line',
                    {
                        yPercent: 108,
                        opacity: 0,
                        duration: 0.92,
                        stagger: 0.12,
                    },
                    '-=0.72',
                )
                .from(
                    '.rpv-hero-subcopy',
                    {
                        y: 16,
                        opacity: 0,
                        duration: 0.72,
                    },
                    '-=0.58',
                )
                .from(
                    '.rpv-hero-actions > *',
                    {
                        y: 16,
                        opacity: 0,
                        duration: 0.58,
                        stagger: 0.08,
                    },
                    '-=0.45',
                );

            gsap.to('.rpv-hero-keyword', {
                backgroundPosition: '200% center',
                duration: 8,
                ease: 'none',
                repeat: -1,
            });

            gsap.to('.rpv-hero-float', {
                y: (index) => (index % 2 ? -16 : 14),
                x: (index) => (index % 2 ? 10 : -10),
                duration: (index) => 5.6 + index,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                stagger: 0.2,
            });

            gsap.to('.rpv-hero-text-wrap', {
                scale: 0.93,
                opacity: 0.74,
                ease: 'none',
                scrollTrigger: {
                    trigger: '#home',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                },
            });

            gsap.utils.toArray('.rpv-gsap-section').forEach((section, index) => {
                gsap.from(section, {
                    y: 30,
                    opacity: 0,
                    duration: 0.74,
                    delay: index * 0.03,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: section,
                        start: 'top 82%',
                    },
                });
            });
        }, landingRootRef);

        return () => {
            context.revert();
        };
    }, []);

    useEffect(() => {
        if (USE_SIMPLE_LOGIN_LAYOUT) return undefined;
        const chipsIn = animate('.rpv-chip', {
            opacity: [0, 1],
            y: [14, 0],
            delay: stagger(70, { start: 320 }),
            duration: 620,
            ease: 'outCubic',
        });

        const pulseKeyword = animate('.rpv-hero-keyword', {
            opacity: [0.74, 1],
            duration: 1500,
            ease: 'inOutSine',
            loop: true,
            alternate: true,
        });

        return () => {
            chipsIn.pause();
            pulseKeyword.pause();
        };
    }, []);

    useEffect(() => {
        const hasError = Boolean(loginError || formError || resetError);
        if (!hasError || !accessCardRef.current) return undefined;

        const element = accessCardRef.current;
        let active = true;

        const shake = async () => {
            await Velocity(element, { translateX: 12 }, { duration: 70 });
            if (!active) return;
            await Velocity(element, { translateX: -10 }, { duration: 70 });
            if (!active) return;
            await Velocity(element, { translateX: 8 }, { duration: 60 });
            if (!active) return;
            await Velocity(element, { translateX: 0 }, { duration: 60 });
        };

        shake();

        return () => {
            active = false;
            Velocity(element, 'stop', true);
            Velocity(element, { translateX: 0 }, { duration: 0 });
        };
    }, [loginError, formError, resetError]);

    const scrollToSection = (targetId) => {
        const section = document.getElementById(targetId);
        if (!section) return;

        gsap.to(window, {
            duration: 0.9,
            ease: 'power3.inOut',
            scrollTo: {
                y: section,
                offsetY: 84,
            },
        });
    };

    const scrollToAccess = () => {
        scrollToSection('login');
        setMobileMenuOpen(false);
    };

    const openMode = (nextMode) => {
        setMode(nextMode);
        setNotice('');
        setLoginError('');
        setFormError('');
        setResetError('');
    };

    const handleNavLinkClick = (event, href) => {
        event.preventDefault();
        scrollToSection(href.replace('#', ''));
        setMobileMenuOpen(false);
    };

    const openResetConfirmForEmail = (nextEmail, message) => {
        setNotice(message);
        setLoginError('');
        setFormError('');
        setResetError('');
        setResetRequestForm(emptyResetRequestForm());
        setResetConfirmForm({
            ...emptyResetConfirmForm(),
            email: nextEmail.trim().toLowerCase(),
        });
        setMode('reset-confirm');
        requestAnimationFrame(scrollToAccess);
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        const emailError = validateEmail(email);
        if (emailError) {
            setLoginError(emailError);
            return;
        }

        if (!masterKey.trim()) {
            setLoginError('Master key is required.');
            return;
        }

        setLoginLoading(true);
        setLoginError('');
        setNotice('');

        const result = await login(email.trim(), masterKey);
        if (!result.ok) {
            if (result.action === 'master_key_setup_required') {
                openResetConfirmForEmail(
                    result.email ?? email,
                    result.error ?? 'A reset code has been sent to the restaurant email so you can set the master key.',
                );
                setMasterKey('');
            } else {
                setLoginError(result.error ?? 'Unable to sign in.');
            }
        }

        setLoginLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!form.name.trim()) {
            setFormError('Restaurant name is required.');
            return;
        }

        const emailError = validateEmail(form.email);
        if (emailError) {
            setFormError(emailError);
            return;
        }

        const masterKeyError = validateMasterKey(form.masterKey);
        if (masterKeyError) {
            setFormError(masterKeyError);
            return;
        }

        const adminPinError = validateRolePin('Admin', form.adminPin);
        if (adminPinError) {
            setFormError(adminPinError);
            return;
        }

        const waiterPinError = validateRolePin('Waiter', form.waiterPin);
        if (waiterPinError) {
            setFormError(waiterPinError);
            return;
        }

        setCreating(true);

        try {
            await createProfile({
                name: form.name.trim(),
                email: form.email.trim(),
                address: form.address.trim(),
                phone: form.phone.trim(),
                masterKey: form.masterKey,
                adminPin: form.adminPin,
                waiterPin: form.waiterPin,
                adminPinEnabled: form.adminPinEnabled,
                waiterPinEnabled: form.waiterPinEnabled,
            });

            setForm(emptyRestaurantForm());
            setMode('login');
            setEmail(form.email.trim().toLowerCase());
            setMasterKey('');
            setNotice('Restaurant created. Sign in with the restaurant email and master key.');
            requestAnimationFrame(scrollToAccess);
        } catch (err) {
            if (err?.payload?.action === 'master_key_setup_required') {
                openResetConfirmForEmail(
                    err.payload.email ?? form.email,
                    err.message ?? 'A reset code has been sent to the restaurant email so you can set the master key.',
                );
            } else {
                setFormError(err.message ?? 'Unable to create the restaurant.');
            }
        } finally {
            setCreating(false);
        }
    };

    const handleResetRequest = async (e) => {
        e.preventDefault();
        setResetError('');
        setNotice('');

        const emailError = validateEmail(resetRequestForm.email);
        if (emailError) {
            setResetError(emailError);
            return;
        }

        setResetting(true);

        try {
            const payload = await requestPasswordReset(resetRequestForm.email);
            setNotice(payload.message);
            setResetConfirmForm({
                ...emptyResetConfirmForm(),
                email: resetRequestForm.email.trim().toLowerCase(),
            });
            setMode('reset-confirm');
            requestAnimationFrame(scrollToAccess);
        } catch (err) {
            setResetError(err.message ?? 'Unable to send the reset code.');
        } finally {
            setResetting(false);
        }
    };

    const handleResetConfirm = async (e) => {
        e.preventDefault();
        setResetError('');
        setNotice('');

        const emailError = validateEmail(resetConfirmForm.email);
        if (emailError) {
            setResetError(emailError);
            return;
        }

        if (!resetConfirmForm.code.trim()) {
            setResetError('Reset code is required.');
            return;
        }

        const masterKeyError = validateMasterKey(resetConfirmForm.masterKey);
        if (masterKeyError) {
            setResetError(masterKeyError);
            return;
        }

        if (resetConfirmForm.adminPin) {
            const adminPinError = validateRolePin('Admin', resetConfirmForm.adminPin);
            if (adminPinError) {
                setResetError(adminPinError);
                return;
            }
        }

        if (resetConfirmForm.waiterPin) {
            const waiterPinError = validateRolePin('Waiter', resetConfirmForm.waiterPin);
            if (waiterPinError) {
                setResetError(waiterPinError);
                return;
            }
        }

        setResetting(true);

        try {
            const payload = await resetPasswordWithCode({
                email: resetConfirmForm.email,
                code: resetConfirmForm.code.trim(),
                masterKey: resetConfirmForm.masterKey,
                ...(resetConfirmForm.adminPin ? { adminPin: resetConfirmForm.adminPin } : {}),
                ...(resetConfirmForm.waiterPin ? { waiterPin: resetConfirmForm.waiterPin } : {}),
            });

            setNotice(payload.message);
            setEmail(resetConfirmForm.email);
            setMasterKey('');
            setResetRequestForm(emptyResetRequestForm());
            setResetConfirmForm(emptyResetConfirmForm());
            setMode('login');
            requestAnimationFrame(scrollToAccess);
        } catch (err) {
            setResetError(err.message ?? 'Unable to reset restaurant access.');
        } finally {
            setResetting(false);
        }
    };

    if (USE_SIMPLE_LOGIN_LAYOUT) {
        const isResetMode = mode === 'reset-request' || mode === 'reset-confirm';
        const isLoginMode = mode === 'login';
        const title = mode === 'login' ? 'Welcome to your Restaurant Centre' : renderAuthTitle(mode);
        const subtitle = mode === 'login' ? 'Sign in with your restaurant email and password.' : renderAuthSubtitle(mode);
        const lineRowClass = 'grid grid-cols-[28px_1fr] items-center gap-4';
        const lineIconClass = 'pointer-events-none text-[#a2a7af]';
        const lineInputClass = (hasError) =>
            `h-[50px] w-full border-0 border-b bg-transparent px-0 text-[1.03rem] font-medium leading-none text-[#2f3438] outline-none placeholder:text-[#8f96a0] ${
                hasError ? 'border-[#F04438]' : 'border-[#b7bbc4]'
            } focus:border-[#2563eb]`;

        return (
            <div className="min-h-screen bg-[#d9e6f7] font-['Poppins',sans-serif] text-[#1F2937]">
                <div className="mx-auto grid min-h-screen max-w-[1200px] lg:grid-cols-[1.04fr_0.96fr]">
                    <aside className="relative min-h-[36vh] overflow-hidden lg:min-h-screen">
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{
                                backgroundImage:
                                    'url("https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1700&q=80")',
                            }}
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(37,99,235,0.82)_0%,rgba(59,130,246,0.78)_24%,rgba(6,182,212,0.72)_40%,rgba(34,197,94,0.64)_56%,rgba(234,179,8,0.58)_72%,rgba(249,115,22,0.54)_86%,rgba(239,68,68,0.52)_100%)]" />
                        <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center sm:px-12 lg:px-14">
                            <h1 className="text-[4rem] font-semibold tracking-tight text-white sm:text-[5rem] lg:text-[6.4rem]">Welcome</h1>
                            <p className="mt-3 text-[1.1rem] font-medium tracking-wide text-[#fff4e8] sm:text-[1.3rem]">all at one</p>
                        </div>
                    </aside>

                    <main id="login" className="relative flex items-center justify-center overflow-hidden bg-[#e6e8ee] px-6 py-10 sm:px-10 lg:px-14">
                        <div ref={accessCardRef} className="relative mx-auto w-full max-w-[460px]">
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 text-[#2563eb]">
                                    <Store size={22} />
                                    <span className="bg-gradient-to-r from-[#2563eb] via-[#0ea5e9] to-[#4f46e5] bg-clip-text text-[2.1rem] font-semibold tracking-tight text-transparent">
                                        Restaurant
                                    </span>
                                </div>
                                <h2 className="mx-auto mt-12 max-w-[24rem] text-[2.55rem] font-semibold leading-[1.06] tracking-tight text-[#2f3438] sm:text-[2.8rem]">
                                    {title}
                                </h2>
                                <p className="mx-auto mt-2 max-w-[24rem] text-[0.95rem] text-[#677084]">{subtitle}</p>
                            </div>

                            {notice ? (
                                <div className="mt-6 rounded-xl border border-[#7ed0a7] bg-[#edfff6]/95 px-4 py-3 text-sm font-semibold text-[#0f7c45]">
                                    {notice}
                                </div>
                            ) : null}

                            {!isLoginMode ? (
                                <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-white/70 bg-white/35 p-1.5">
                                    <button
                                        type="button"
                                        onClick={() => openMode('login')}
                                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                            mode === 'login' ? 'bg-white/90 text-[#1F2937] shadow-sm' : 'text-[#667085] hover:bg-white/65'
                                        }`}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openMode('create')}
                                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                            mode === 'create' ? 'bg-white/90 text-[#1F2937] shadow-sm' : 'text-[#667085] hover:bg-white/65'
                                        }`}
                                    >
                                        Create
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openMode('reset-request')}
                                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                            isResetMode ? 'bg-white/90 text-[#1F2937] shadow-sm' : 'text-[#667085] hover:bg-white/65'
                                        }`}
                                    >
                                        Reset
                                    </button>
                                </div>
                            ) : null}

                            {mode === 'login' && (
                                <form onSubmit={handleLogin} className="mt-12 space-y-8">
                                    <label htmlFor="simple-login-email" className="block">
                                        <span className="sr-only">Restaurant email</span>
                                        <div className={lineRowClass}>
                                            <Mail size={24} className={lineIconClass} />
                                            <input
                                                id="simple-login-email"
                                                type="email"
                                                className={lineInputClass(Boolean(loginError))}
                                                placeholder="Username"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setLoginError('');
                                                }}
                                                autoComplete="username"
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="simple-login-master-key" className="block">
                                        <span className="sr-only">Password / master key</span>
                                        <div className={lineRowClass}>
                                            <KeyRound size={24} className={lineIconClass} />
                                            <input
                                                id="simple-login-master-key"
                                                type={showMasterKey ? 'text' : 'password'}
                                                className={lineInputClass(Boolean(loginError))}
                                                placeholder="Password"
                                                value={masterKey}
                                                onChange={(e) => {
                                                    setMasterKey(e.target.value);
                                                    setLoginError('');
                                                }}
                                                autoComplete="current-password"
                                            />
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2.5 text-[0.95rem] font-medium text-[#667085]">
                                        <input
                                            type="checkbox"
                                            checked={keepSignedIn}
                                            onChange={(e) => setKeepSignedIn(e.target.checked)}
                                            className="h-4 w-4 rounded border-[#d1d5db] text-[#2563eb] focus:ring-[#93c5fd]"
                                        />
                                        Keep me signed in
                                    </label>

                                    {loginError ? <p className="text-sm font-semibold text-[#F04438]">{loginError}</p> : null}

                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="inline-flex h-[54px] w-full items-center justify-center rounded-md bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#4f46e5] text-[1.1rem] font-semibold uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:from-[#1d4ed8] hover:via-[#2563eb] hover:to-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={!email || !masterKey || loginLoading}
                                    >
                                        {loginLoading ? 'Loading...' : 'Log In'}
                                    </motion.button>

                                    <div className="pt-2 text-center">
                                        <button
                                            className="text-[0.95rem] font-medium text-[#1f6bb5] transition hover:text-[#0f4f8e]"
                                            type="button"
                                            onClick={() => openMode('reset-request')}
                                        >
                                            Forgot password
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-center gap-2 pt-1 text-[0.9rem] text-[#717680]">
                                        <span>Need a new restaurant profile?</span>
                                        <button
                                            type="button"
                                            className="font-semibold text-[#1f6bb5] transition hover:text-[#0f4f8e]"
                                            onClick={() => openMode('create')}
                                        >
                                            Create account
                                        </button>
                                    </div>
                                </form>
                            )}

                            {mode === 'create' && (
                                <form
                                    onSubmit={handleCreate}
                                    className="mt-12 space-y-8"
                                >
                                    <label htmlFor="create-name" className="block">
                                        <span className="sr-only">Restaurant name</span>
                                        <div className={lineRowClass}>
                                            <Store size={24} className={lineIconClass} />
                                            <input
                                                id="create-name"
                                                className={lineInputClass(Boolean(formError))}
                                                placeholder="Restaurant name"
                                                value={form.name}
                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="create-email" className="block">
                                        <span className="sr-only">Restaurant email</span>
                                        <div className={lineRowClass}>
                                            <Mail size={24} className={lineIconClass} />
                                            <input
                                                id="create-email"
                                                type="email"
                                                className={lineInputClass(Boolean(formError))}
                                                placeholder="you@restaurant.com"
                                                value={form.email}
                                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="create-address" className="block">
                                        <span className="sr-only">Address</span>
                                        <div className={lineRowClass}>
                                            <MapPin size={24} className={lineIconClass} />
                                            <input
                                                id="create-address"
                                                className={lineInputClass(Boolean(formError))}
                                                placeholder="Street and number"
                                                value={form.address}
                                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="create-phone" className="block">
                                        <span className="sr-only">Phone</span>
                                        <div className={lineRowClass}>
                                            <Phone size={24} className={lineIconClass} />
                                            <input
                                                id="create-phone"
                                                className={lineInputClass(Boolean(formError))}
                                                placeholder="+49 ..."
                                                value={form.phone}
                                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="create-master-key" className="block">
                                        <span className="sr-only">Password / master key</span>
                                        <div className={lineRowClass}>
                                            <KeyRound size={24} className={lineIconClass} />
                                            <input
                                                id="create-master-key"
                                                type={showCreateMaster ? 'text' : 'password'}
                                                className={lineInputClass(Boolean(formError))}
                                                placeholder="Create password"
                                                value={form.masterKey}
                                                onChange={(e) => setForm({ ...form, masterKey: e.target.value })}
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="create-admin-pin" className="block">
                                        <span className="sr-only">Admin PIN</span>
                                        <div className={lineRowClass}>
                                            <ShieldCheck size={24} className={lineIconClass} />
                                            <input
                                                id="create-admin-pin"
                                                type={showAdminPin ? 'text' : 'password'}
                                                className={lineInputClass(Boolean(formError))}
                                                placeholder="Admin PIN"
                                                value={form.adminPin}
                                                onChange={(e) => setForm({ ...form, adminPin: e.target.value })}
                                                inputMode="numeric"
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="create-waiter-pin" className="block">
                                        <span className="sr-only">Waiter PIN</span>
                                        <div className={lineRowClass}>
                                            <BadgeCheck size={24} className={lineIconClass} />
                                            <input
                                                id="create-waiter-pin"
                                                type={showWaiterPin ? 'text' : 'password'}
                                                className={lineInputClass(Boolean(formError))}
                                                placeholder="Waiter PIN"
                                                value={form.waiterPin}
                                                onChange={(e) => setForm({ ...form, waiterPin: e.target.value })}
                                                inputMode="numeric"
                                            />
                                        </div>
                                    </label>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="flex items-center gap-2.5 text-[0.95rem] font-medium text-[#667085]">
                                            <input
                                                type="checkbox"
                                                checked={form.adminPinEnabled}
                                                onChange={(e) => setForm({ ...form, adminPinEnabled: e.target.checked })}
                                                className="h-4 w-4 rounded border-[#d1d5db] text-[#2563eb] focus:ring-[#93c5fd]"
                                            />
                                            Require Admin PIN
                                        </label>
                                        <label className="flex items-center gap-2.5 text-[0.95rem] font-medium text-[#667085]">
                                            <input
                                                type="checkbox"
                                                checked={form.waiterPinEnabled}
                                                onChange={(e) => setForm({ ...form, waiterPinEnabled: e.target.checked })}
                                                className="h-4 w-4 rounded border-[#d1d5db] text-[#2563eb] focus:ring-[#93c5fd]"
                                            />
                                            Require Waiter PIN
                                        </label>
                                    </div>

                                    {formError ? <p className="text-sm font-semibold text-[#F04438]">{formError}</p> : null}

                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="inline-flex h-[54px] w-full items-center justify-center rounded-md bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#4f46e5] text-[1.1rem] font-semibold uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:from-[#1d4ed8] hover:via-[#2563eb] hover:to-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={creating}
                                    >
                                        {creating ? 'Processing...' : 'Create'}
                                    </motion.button>

                                    <div className="pt-2 text-center">
                                        <button
                                            type="button"
                                            className="text-[0.95rem] font-medium text-[#1f6bb5] transition hover:text-[#0f4f8e]"
                                            onClick={() => openMode('login')}
                                        >
                                            Back to login
                                        </button>
                                    </div>
                                </form>
                            )}

                            {mode === 'reset-request' && (
                                <form
                                    onSubmit={handleResetRequest}
                                    className="mt-12 space-y-8"
                                >
                                    <label htmlFor="reset-request-email" className="block">
                                        <span className="sr-only">Restaurant email</span>
                                        <div className={lineRowClass}>
                                            <Mail size={24} className={lineIconClass} />
                                            <input
                                                id="reset-request-email"
                                                type="email"
                                                className={lineInputClass(Boolean(resetError))}
                                                placeholder="you@restaurant.com"
                                                value={resetRequestForm.email}
                                                onChange={(e) => {
                                                    setResetRequestForm({ email: e.target.value });
                                                    setResetError('');
                                                }}
                                            />
                                        </div>
                                    </label>

                                    {resetError ? <p className="text-sm font-semibold text-[#F04438]">{resetError}</p> : null}

                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="inline-flex h-[54px] w-full items-center justify-center rounded-md bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#4f46e5] text-[1.1rem] font-semibold uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:from-[#1d4ed8] hover:via-[#2563eb] hover:to-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={resetting}
                                    >
                                        {resetting ? 'Sending...' : 'Send code'}
                                    </motion.button>

                                    <div className="pt-2 text-center">
                                        <button
                                            type="button"
                                            className="text-[0.95rem] font-medium text-[#1f6bb5] transition hover:text-[#0f4f8e]"
                                            onClick={() => openMode('login')}
                                        >
                                            Back to login
                                        </button>
                                    </div>
                                </form>
                            )}

                            {mode === 'reset-confirm' && (
                                <form
                                    onSubmit={handleResetConfirm}
                                    className="mt-12 space-y-8"
                                >
                                    <label htmlFor="reset-email" className="block">
                                        <span className="sr-only">Email</span>
                                        <div className={lineRowClass}>
                                            <Mail size={24} className={lineIconClass} />
                                            <input
                                                id="reset-email"
                                                className={lineInputClass(Boolean(resetError))}
                                                placeholder="you@restaurant.com"
                                                value={resetConfirmForm.email}
                                                onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, email: e.target.value })}
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="reset-code" className="block">
                                        <span className="sr-only">Reset code</span>
                                        <div className={lineRowClass}>
                                            <KeyRound size={24} className={lineIconClass} />
                                            <input
                                                id="reset-code"
                                                className={lineInputClass(Boolean(resetError))}
                                                placeholder="6-digit code"
                                                value={resetConfirmForm.code}
                                                onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, code: e.target.value })}
                                                inputMode="numeric"
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="reset-master-key" className="block">
                                        <span className="sr-only">New password / master key</span>
                                        <div className={lineRowClass}>
                                            <KeyRound size={24} className={lineIconClass} />
                                            <input
                                                id="reset-master-key"
                                                type={showResetMaster ? 'text' : 'password'}
                                                className={lineInputClass(Boolean(resetError))}
                                                placeholder="New password"
                                                value={resetConfirmForm.masterKey}
                                                onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, masterKey: e.target.value })}
                                            />
                                        </div>
                                    </label>

                                    <label htmlFor="reset-admin-pin" className="block">
                                        <span className="sr-only">New Admin PIN</span>
                                        <div className={lineRowClass}>
                                            <ShieldCheck size={24} className={lineIconClass} />
                                                <input
                                                    id="reset-admin-pin"
                                                    type={showResetAdminPin ? 'text' : 'password'}
                                                    className={lineInputClass(Boolean(resetError))}
                                                    placeholder="New Admin PIN (optional)"
                                                    value={resetConfirmForm.adminPin}
                                                    onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, adminPin: e.target.value })}
                                                    inputMode="numeric"
                                                />
                                        </div>
                                    </label>

                                    <label htmlFor="reset-waiter-pin" className="block">
                                        <span className="sr-only">New Waiter PIN</span>
                                        <div className={lineRowClass}>
                                            <BadgeCheck size={24} className={lineIconClass} />
                                                <input
                                                    id="reset-waiter-pin"
                                                    type={showResetWaiterPin ? 'text' : 'password'}
                                                    className={lineInputClass(Boolean(resetError))}
                                                    placeholder="New Waiter PIN (optional)"
                                                    value={resetConfirmForm.waiterPin}
                                                    onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, waiterPin: e.target.value })}
                                                    inputMode="numeric"
                                                />
                                        </div>
                                    </label>

                                    {resetError ? <p className="text-sm font-semibold text-[#F04438]">{resetError}</p> : null}

                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="inline-flex h-[54px] w-full items-center justify-center rounded-md bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#4f46e5] text-[1.1rem] font-semibold uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:from-[#1d4ed8] hover:via-[#2563eb] hover:to-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={resetting}
                                    >
                                        {resetting ? 'Updating...' : 'Set password'}
                                    </motion.button>

                                    <div className="pt-2 text-center">
                                        <button
                                            type="button"
                                            className="text-[0.95rem] font-medium text-[#1f6bb5] transition hover:text-[#0f4f8e]"
                                            onClick={() => openMode('reset-request')}
                                        >
                                            Back to code request
                                        </button>
                                    </div>
                                </form>
                            )}

                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div ref={landingRootRef} className="landing-screen rpv-landing font-sans text-[#1F2937]">
            <header className="rpv-nav-shell sticky top-0 z-50">
                <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <a href="#home" onClick={(event) => handleNavLinkClick(event, '#home')} className="flex items-center gap-3 no-underline">
                        <span className="rpv-brand-mark flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563eb] text-white">
                            <Store size={20} />
                        </span>
                        <span className="font-display text-xl font-bold tracking-tight text-[#1F2937]">
                            Restaurant
                            <span className="rpv-accent-dot ml-2 inline-block align-middle" />
                        </span>
                    </a>

                    <nav className="hidden items-center gap-8 md:flex">
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={(event) => handleNavLinkClick(event, link.href)}
                                className="rpv-nav-link text-sm font-semibold"
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.985 }}
                            onClick={scrollToAccess}
                            className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-[#1e40af] sm:px-5"
                        >
                            Login
                            <ArrowRight size={16} />
                        </motion.button>

                        <button
                            type="button"
                            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                            aria-expanded={mobileMenuOpen}
                            aria-controls="landing-mobile-menu"
                            onClick={() => setMobileMenuOpen((current) => !current)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbeafe] bg-white text-[#1F2937] md:hidden"
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {mobileMenuOpen ? (
                    <div id="landing-mobile-menu" className="border-t border-[#dbeafe] bg-[#f8fbff] px-4 py-4 md:hidden">
                        <nav className="flex flex-col gap-2">
                            {navLinks.map((link) => (
                                <a
                                    key={`mobile-${link.label}`}
                                    href={link.href}
                                    onClick={(event) => handleNavLinkClick(event, link.href)}
                                    className="rpv-mobile-link rounded-2xl px-4 py-3 text-sm font-semibold"
                                >
                                    {link.label}
                                </a>
                            ))}
                            <a
                                href="#contact"
                                onClick={(event) => handleNavLinkClick(event, '#contact')}
                                className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-sm font-semibold text-[#1e40af]"
                            >
                                Request Demo
                            </a>
                        </nav>
                    </div>
                ) : null}
            </header>

            <main>
                <section id="home" className="rpv-hero-canvas relative overflow-hidden border-b border-[#dbeafe]/70 bg-[linear-gradient(180deg,#f8fbff_0%,#eff6ff_100%)]">
                    <HeroThreeBackdrop />
                    <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-64 w-64 rounded-full bg-[#bfdbfe] blur-3xl rpv-hero-float" />
                    <div className="pointer-events-none absolute right-[-7rem] top-10 h-56 w-56 rounded-full bg-[#dbeafe] blur-3xl rpv-hero-float" />
                    <div className="pointer-events-none absolute bottom-[-7rem] right-1/3 h-52 w-52 rounded-full bg-[#dbeafe] blur-3xl rpv-hero-float" />
                    <p className="rpv-hero-bg-word rpv-hero-float left-4 top-[5.5rem]">RESTAURANT</p>
                    <p className="rpv-hero-bg-word rpv-hero-float bottom-24 right-4">ORDER FLOW</p>

                    <div className="relative mx-auto flex min-h-[calc(100vh-76px)] max-w-[1280px] items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
                        <div className="w-full">
                            <animated.div
                                style={{ transform: heroCardFloat.y.to((value) => `translate3d(0, ${value}px, 0)`) }}
                                className="will-change-transform"
                            >
                            <motion.div {...sectionMotion} className="rpv-hero-text-wrap mx-auto max-w-[1100px] text-center">
                                <div className="rpv-hero-subcopy inline-flex items-center gap-2 rounded-full bg-[#dbeafe] px-4 py-2 text-sm font-semibold text-[#1e40af]">
                                    <BadgeCheck size={16} />
                                    Restaurant operations made simple
                                </div>

                                <h1 className="rpv-heading rpv-hero-headline mt-6 rpv-hero-display font-extrabold tracking-[-0.045em] text-[#1F2937]">
                                    <span className="block overflow-hidden">
                                        <span className="rpv-hero-line block">A modern system for managing</span>
                                    </span>
                                    <span className="block overflow-hidden">
                                        <span className="rpv-hero-line rpv-hero-keyword block">orders, ticket numbers, timing, and receipts</span>
                                    </span>
                                    <span className="block overflow-hidden">
                                        <span className="rpv-hero-line block">built for speed and accuracy</span>
                                    </span>
                                </h1>

                                <p className="rpv-copy rpv-hero-subcopy mx-auto mt-7 max-w-[900px] text-base md:text-lg">
                                    Designed for restaurants that need faster takeaway and delivery workflows, cleaner order tracking, and reliable control for staff and admin.
                                </p>

                                <div className="rpv-hero-actions mt-9 flex flex-wrap items-center justify-center gap-3">
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.985 }}
                                        onClick={scrollToAccess}
                                        className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition hover:bg-[#1e40af]"
                                    >
                                        Login
                                        <ArrowRight size={16} />
                                    </motion.button>

                                    <motion.a
                                        whileHover={{ y: -1 }}
                                        href="#demo"
                                        onClick={(event) => handleNavLinkClick(event, '#demo')}
                                        className="inline-flex items-center gap-2 rounded-full border border-[#dbeafe] bg-white px-6 py-3.5 text-sm font-semibold text-[#1F2937] no-underline shadow-sm transition hover:border-[#93c5fd]"
                                    >
                                        See Demo
                                    </motion.a>
                                </div>

                                <p className="rpv-hero-subcopy mt-5 text-sm font-semibold text-[#6B7280]">Built for staff and admin access</p>

                                <div className="mt-8 flex flex-wrap justify-center gap-3">
                                    {chipTrail.map((trailStyle, index) => {
                                        const chip = heroChips[index];
                                        return (
                                            <animated.div
                                                key={chip.label}
                                                style={{
                                                    opacity: trailStyle.opacity,
                                                    transform: trailStyle.y.to((value) => `translate3d(0, ${value}px, 0)`),
                                                }}
                                                className="rpv-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                                            >
                                                <chip.icon size={15} />
                                                {chip.label}
                                            </animated.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                            </animated.div>
                        </div>
                    </div>
                </section>

                <motion.section
                                id="login"
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.48, delay: 0.22 }}
                                className="rpv-anchor rpv-gsap-section rpv-section mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8"
                            >
                                <div className="mx-auto max-w-[760px] border-t border-[#dbeafe]/80 pt-10 rpv-fade-up">
                                        <div className="mb-4">
                                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1e40af]">Access your workspace</p>
                                            <p className="mt-2 text-sm text-[#6B7280]">
                                                Sign in to manage restaurant orders, tickets, timing, and daily operations.
                                            </p>
                                        </div>
                                        <div ref={accessCardRef} className="rpv-access-card rounded-[32px] border border-[#dbeafe] bg-white p-6 sm:p-7">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h2 className="rpv-heading text-2xl font-bold tracking-tight text-[#1F2937]">{renderAuthTitle(mode)}</h2>
                                                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{renderAuthSubtitle(mode)}</p>
                                                </div>
                                                <span className="rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1e40af]">
                                                    Staff & Admin Access
                                                </span>
                                            </div>

                                            <div className="mt-6 flex gap-2 rounded-2xl bg-[#eff6ff] p-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openMode('login')}
                                                    className={`rpv-tab-btn flex-1 ${mode === 'login' ? 'is-active' : ''}`}
                                                >
                                                    Sign In
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openMode('create')}
                                                    className={`rpv-tab-btn flex-1 ${mode === 'create' ? 'is-active' : ''}`}
                                                >
                                                    Create
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openMode('reset-request')}
                                                    className={`rpv-tab-btn flex-1 ${mode.startsWith('reset') ? 'is-active' : ''}`}
                                                >
                                                    Reset
                                                </button>
                                            </div>

                                            {notice ? (
                                                <div className="rpv-status-success mt-5 rounded-2xl px-4 py-3 text-sm font-semibold">
                                                    {notice}
                                                </div>
                                            ) : null}

                                            {mode === 'login' && (
                                                <form onSubmit={handleLogin} className="mt-6 space-y-5">
                                                    <AuthField label="Email" icon={Mail} inputId="login-email">
                                                        <input
                                                            id="login-email"
                                                            type="email"
                                                            className={inputClass(Boolean(loginError))}
                                                            placeholder="you@restaurant.com"
                                                            value={email}
                                                            onChange={(e) => {
                                                                setEmail(e.target.value);
                                                                setLoginError('');
                                                            }}
                                                            autoComplete="username"
                                                        />
                                                    </AuthField>

                                                    <AuthField label="Password / master key" icon={KeyRound} inputId="login-master-key">
                                                        <div className="relative">
                                                            <input
                                                                id="login-master-key"
                                                                type={showMasterKey ? 'text' : 'password'}
                                                                className={inputClass(Boolean(loginError))}
                                                                placeholder="Enter your password"
                                                                value={masterKey}
                                                                onChange={(e) => {
                                                                    setMasterKey(e.target.value);
                                                                    setLoginError('');
                                                                }}
                                                                autoComplete="current-password"
                                                            />
                                                            <button
                                                                type="button"
                                                                aria-label={showMasterKey ? 'Hide master key' : 'Show master key'}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937]"
                                                                onClick={() => setShowMasterKey((current) => !current)}
                                                            >
                                                                {showMasterKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                                            </button>
                                                        </div>
                                                    </AuthField>

                                                    <label className="flex items-center gap-3 text-sm font-medium text-[#6B7280]">
                                                        <input
                                                            type="checkbox"
                                                            checked={keepSignedIn}
                                                            onChange={(e) => setKeepSignedIn(e.target.checked)}
                                                            className="h-4 w-4 rounded border-[#dbeafe] text-[#2563eb] focus:ring-[#93c5fd]"
                                                        />
                                                        Keep me signed in
                                                    </label>

                                                    {loginError ? <p className="text-sm font-semibold text-[#F04438]">{loginError}</p> : null}

                                                    <motion.button
                                                        type="submit"
                                                        whileHover={{ scale: 1.01 }}
                                                        whileTap={{ scale: 0.985 }}
                                                        className="rpv-action-btn"
                                                        disabled={!email || !masterKey || loginLoading}
                                                    >
                                                        {loginLoading ? 'Loading...' : 'Login'}
                                                        {!loginLoading ? <ArrowRight size={16} /> : null}
                                                    </motion.button>

                                                    <button
                                                        className="text-sm font-semibold text-[#1e40af] transition hover:text-[#1d4ed8]"
                                                        type="button"
                                                        onClick={() => openMode('reset-request')}
                                                    >
                                                        Forgot password?
                                                    </button>
                                                </form>
                                            )}

                                            {mode === 'create' && (
                                                <form onSubmit={handleCreate} className="mt-6 space-y-5">
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <AuthField label="Restaurant name" icon={Store} inputId="create-name">
                                                            <input
                                                                id="create-name"
                                                                className={inputClass(Boolean(formError))}
                                                                placeholder="Restaurant name"
                                                                value={form.name}
                                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                            />
                                                        </AuthField>
                                                        <AuthField label="Email" icon={Mail} inputId="create-email">
                                                            <input
                                                                id="create-email"
                                                                type="email"
                                                                className={inputClass(Boolean(formError))}
                                                                placeholder="you@restaurant.com"
                                                                value={form.email}
                                                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                                            />
                                                        </AuthField>
                                                    </div>

                                                    <AuthField label="Address" inputId="create-address">
                                                        <input
                                                            id="create-address"
                                                            className={inputClass(Boolean(formError))}
                                                            placeholder="Street and number"
                                                            value={form.address}
                                                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                                                        />
                                                    </AuthField>

                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <AuthField label="Phone" inputId="create-phone">
                                                            <input
                                                                id="create-phone"
                                                                className={inputClass(Boolean(formError))}
                                                                placeholder="+49 ..."
                                                                value={form.phone}
                                                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                                            />
                                                        </AuthField>
                                                        <AuthField label="Password / master key" icon={KeyRound} inputId="create-master-key">
                                                            <div className="relative">
                                                                <input
                                                                    id="create-master-key"
                                                                    type={showCreateMaster ? 'text' : 'password'}
                                                                    className={inputClass(Boolean(formError))}
                                                                    placeholder="Create password"
                                                                    value={form.masterKey}
                                                                    onChange={(e) => setForm({ ...form, masterKey: e.target.value })}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    aria-label={showCreateMaster ? 'Hide master key' : 'Show master key'}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937]"
                                                                    onClick={() => setShowCreateMaster((current) => !current)}
                                                                >
                                                                    {showCreateMaster ? <EyeOff size={18} /> : <Eye size={18} />}
                                                                </button>
                                                            </div>
                                                        </AuthField>
                                                    </div>

                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <AuthField label="Admin PIN" inputId="create-admin-pin">
                                                            <div className="relative">
                                                                <input
                                                                    id="create-admin-pin"
                                                                    type={showAdminPin ? 'text' : 'password'}
                                                                    className={inputClass(Boolean(formError))}
                                                                    placeholder="Optional PIN"
                                                                    value={form.adminPin}
                                                                    onChange={(e) => setForm({ ...form, adminPin: e.target.value })}
                                                                    inputMode="numeric"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    aria-label={showAdminPin ? 'Hide admin PIN' : 'Show admin PIN'}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937]"
                                                                    onClick={() => setShowAdminPin((current) => !current)}
                                                                >
                                                                    {showAdminPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </AuthField>
                                                        <AuthField label="Waiter PIN" inputId="create-waiter-pin">
                                                            <div className="relative">
                                                                <input
                                                                    id="create-waiter-pin"
                                                                    type={showWaiterPin ? 'text' : 'password'}
                                                                    className={inputClass(Boolean(formError))}
                                                                    placeholder="Optional PIN"
                                                                    value={form.waiterPin}
                                                                    onChange={(e) => setForm({ ...form, waiterPin: e.target.value })}
                                                                    inputMode="numeric"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    aria-label={showWaiterPin ? 'Hide waiter PIN' : 'Show waiter PIN'}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937]"
                                                                    onClick={() => setShowWaiterPin((current) => !current)}
                                                                >
                                                                    {showWaiterPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </AuthField>
                                                    </div>

                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        <label className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#6B7280]">
                                                            <input
                                                                type="checkbox"
                                                                checked={form.adminPinEnabled}
                                                                onChange={(e) => setForm({ ...form, adminPinEnabled: e.target.checked })}
                                                                className="h-4 w-4 rounded border-[#dbeafe] text-[#2563eb] focus:ring-[#93c5fd]"
                                                            />
                                                            Require Admin PIN
                                                        </label>
                                                        <label className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#6B7280]">
                                                            <input
                                                                type="checkbox"
                                                                checked={form.waiterPinEnabled}
                                                                onChange={(e) => setForm({ ...form, waiterPinEnabled: e.target.checked })}
                                                                className="h-4 w-4 rounded border-[#dbeafe] text-[#2563eb] focus:ring-[#93c5fd]"
                                                            />
                                                            Require Waiter PIN
                                                        </label>
                                                    </div>

                                                    {formError ? <p className="text-sm font-semibold text-[#F04438]">{formError}</p> : null}

                                                    <motion.button
                                                        type="submit"
                                                        whileHover={{ scale: 1.01 }}
                                                        whileTap={{ scale: 0.985 }}
                                                        className="rpv-action-btn"
                                                        disabled={creating}
                                                    >
                                                        {creating ? 'Processing...' : 'Create account'}
                                                        {!creating ? <Plus size={16} /> : null}
                                                    </motion.button>
                                                </form>
                                            )}

                                            {mode === 'reset-request' && (
                                                <form onSubmit={handleResetRequest} className="mt-6 space-y-5">
                                                    <AuthField label="Email" icon={Mail} inputId="reset-request-email">
                                                        <input
                                                            id="reset-request-email"
                                                            type="email"
                                                            className={inputClass(Boolean(resetError))}
                                                            placeholder="you@restaurant.com"
                                                            value={resetRequestForm.email}
                                                            onChange={(e) => {
                                                                setResetRequestForm({ email: e.target.value });
                                                                setResetError('');
                                                            }}
                                                        />
                                                    </AuthField>

                                                    {resetError ? <p className="text-sm font-semibold text-[#F04438]">{resetError}</p> : null}

                                                    <div className="flex gap-3">
                                                        <button
                                                            type="button"
                                                            className="rpv-outline-btn flex-1 rounded-2xl px-6 py-4 text-sm font-semibold"
                                                            onClick={() => openMode('login')}
                                                        >
                                                            Back
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            className="flex-[2.2] rounded-2xl bg-[#2563eb] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-60"
                                                            disabled={resetting}
                                                        >
                                                            {resetting ? 'Sending...' : 'Send reset link'}
                                                        </button>
                                                    </div>
                                                </form>
                                            )}

                                            {mode === 'reset-confirm' && (
                                                <form onSubmit={handleResetConfirm} className="mt-6 space-y-5">
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <AuthField label="Email" icon={Mail} inputId="reset-email">
                                                            <input
                                                                id="reset-email"
                                                                className={inputClass(Boolean(resetError))}
                                                                value={resetConfirmForm.email}
                                                                onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, email: e.target.value })}
                                                            />
                                                        </AuthField>
                                                        <AuthField label="Reset code" icon={KeyRound} inputId="reset-code">
                                                            <input
                                                                id="reset-code"
                                                                className={inputClass(Boolean(resetError))}
                                                                placeholder="6-digit code"
                                                                value={resetConfirmForm.code}
                                                                onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, code: e.target.value })}
                                                                inputMode="numeric"
                                                            />
                                                        </AuthField>
                                                    </div>

                                                    <AuthField label="New password / master key" icon={KeyRound} inputId="reset-master-key">
                                                        <div className="relative">
                                                            <input
                                                                id="reset-master-key"
                                                                type={showResetMaster ? 'text' : 'password'}
                                                                className={inputClass(Boolean(resetError))}
                                                                placeholder="New password"
                                                                value={resetConfirmForm.masterKey}
                                                                onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, masterKey: e.target.value })}
                                                            />
                                                            <button
                                                                type="button"
                                                                aria-label={showResetMaster ? 'Hide new master key' : 'Show new master key'}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937]"
                                                                onClick={() => setShowResetMaster((current) => !current)}
                                                            >
                                                                {showResetMaster ? <EyeOff size={18} /> : <Eye size={18} />}
                                                            </button>
                                                        </div>
                                                    </AuthField>

                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <AuthField label="New Admin PIN" inputId="reset-admin-pin">
                                                            <div className="relative">
                                                                <input
                                                                    id="reset-admin-pin"
                                                                    type={showResetAdminPin ? 'text' : 'password'}
                                                                    className={inputClass(Boolean(resetError))}
                                                                    placeholder="Leave blank to keep"
                                                                    value={resetConfirmForm.adminPin}
                                                                    onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, adminPin: e.target.value })}
                                                                    inputMode="numeric"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    aria-label={showResetAdminPin ? 'Hide new admin PIN' : 'Show new admin PIN'}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937]"
                                                                    onClick={() => setShowResetAdminPin((current) => !current)}
                                                                >
                                                                    {showResetAdminPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </AuthField>
                                                        <AuthField label="New Waiter PIN" inputId="reset-waiter-pin">
                                                            <div className="relative">
                                                                <input
                                                                    id="reset-waiter-pin"
                                                                    type={showResetWaiterPin ? 'text' : 'password'}
                                                                    className={inputClass(Boolean(resetError))}
                                                                    placeholder="Leave blank to keep"
                                                                    value={resetConfirmForm.waiterPin}
                                                                    onChange={(e) => setResetConfirmForm({ ...resetConfirmForm, waiterPin: e.target.value })}
                                                                    inputMode="numeric"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    aria-label={showResetWaiterPin ? 'Hide new waiter PIN' : 'Show new waiter PIN'}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937]"
                                                                    onClick={() => setShowResetWaiterPin((current) => !current)}
                                                                >
                                                                    {showResetWaiterPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </AuthField>
                                                    </div>

                                                    {resetError ? <p className="text-sm font-semibold text-[#F04438]">{resetError}</p> : null}

                                                    <div className="flex gap-3">
                                                        <button
                                                            type="button"
                                                            className="rpv-outline-btn flex-1 rounded-2xl px-6 py-4 text-sm font-semibold"
                                                            onClick={() => openMode('reset-request')}
                                                        >
                                                            Back
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            className="flex-[2] rounded-2xl bg-[#2563eb] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-60"
                                                            disabled={resetting}
                                                        >
                                                            {resetting ? 'Updating...' : 'Set new password'}
                                                        </button>
                                                    </div>
                                                </form>
                                            )}
                                        </div>
                                </div>
                </motion.section>

                <motion.section {...sectionMotion} id="how-it-works" className="rpv-anchor rpv-gsap-section rpv-section rpv-section-transition mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
                    <div className="rpv-section-card px-6 py-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1e40af]">How it works</p>
                                <h2 className="rpv-heading mt-2 text-2xl font-bold tracking-tight text-[#1F2937] md:text-3xl">
                                    A simple operational flow for takeaway and delivery teams.
                                </h2>
                            </div>
                        </div>

                        <div className="mt-8 grid gap-4 lg:grid-cols-3">
                            {workflowSteps.map((step) => (
                                <motion.div
                                    key={step.number}
                                    whileHover={{ y: -2 }}
                                    className="rpv-hover-lift rounded-[24px] border border-[#dbeafe] bg-[#f8fbff] p-5"
                                >
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dbeafe] text-sm font-bold text-[#1e40af]">
                                        {step.number}
                                    </div>
                                    <h3 className="mt-4 text-lg font-bold text-[#1F2937]">{step.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-[#6B7280]">{step.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    {...sectionMotion}
                    id="features"
                    className="rpv-anchor rpv-gsap-section rpv-section rpv-section-transition mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8"
                >
                    <div className="rpv-section-card p-6 md:p-8">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1e40af]">Built for real restaurant operations</p>
                            <h2 className="rpv-heading mt-2 text-2xl font-bold tracking-tight text-[#1F2937] md:text-3xl">Core features that matter during service</h2>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {featureCards.map((card) => (
                                <motion.article
                                    key={card.title}
                                    whileHover={{ y: -3, scale: 1.01 }}
                                    className="rpv-hover-lift rounded-[24px] border border-[#dbeafe] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
                                >
                                    <div className="inline-flex rounded-2xl bg-[#dbeafe] p-3 text-[#1e40af]">
                                        <card.icon size={18} />
                                    </div>
                                    <h3 className="mt-4 text-lg font-bold text-[#1F2937]">{card.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-[#6B7280]">{card.description}</p>
                                </motion.article>
                            ))}
                        </div>
                    </div>
                </motion.section>

                <motion.section {...sectionMotion} id="services" className="rpv-anchor rpv-gsap-section rpv-section rpv-section-transition mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
                    <div className="rpv-section-card p-6 md:p-8">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1e40af]">Services</p>
                        <h2 className="rpv-heading mt-2 text-2xl font-bold tracking-tight text-[#1F2937] md:text-3xl">
                            Practical services around daily restaurant operations
                        </h2>
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {serviceCards.map((service) => (
                                <motion.article
                                    key={service.title}
                                    whileHover={{ y: -2 }}
                                    className="rpv-hover-lift rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-5"
                                >
                                    <h3 className="text-base font-bold text-[#1F2937]">{service.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-[#6B7280]">{service.description}</p>
                                </motion.article>
                            ))}
                        </div>
                    </div>
                </motion.section>

                <motion.section {...sectionMotion} id="pricing" className="rpv-anchor rpv-gsap-section rpv-section rpv-section-transition mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
                    <div className="rpv-section-card p-6 md:p-8">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1e40af]">Pricing</p>
                        <h2 className="rpv-heading mt-2 text-2xl font-bold tracking-tight text-[#1F2937] md:text-3xl">
                            Clear plans for restaurants of different sizes
                        </h2>
                        <div className="mt-6 grid gap-4 lg:grid-cols-3">
                            {pricingPlans.map((plan) => (
                                <motion.article
                                    key={plan.name}
                                    whileHover={{ y: -2 }}
                                    className={`rpv-hover-lift rounded-[24px] border p-6 shadow-sm ${
                                        plan.featured
                                            ? 'border-[#93c5fd] bg-[#FFF6EE]'
                                            : 'border-[#dbeafe] bg-white'
                                    }`}
                                >
                                    <h3 className="text-lg font-bold text-[#1F2937]">{plan.name}</h3>
                                    <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#1F2937]">
                                        {plan.price}
                                        {plan.period ? <span className="ml-1 text-sm font-semibold text-[#6B7280]">{plan.period}</span> : null}
                                    </p>
                                    <p className="mt-3 text-sm leading-7 text-[#6B7280]">{plan.summary}</p>
                                    <div className="mt-4 space-y-2">
                                        {plan.highlights.map((highlight) => (
                                            <p key={`${plan.name}-${highlight}`} className="flex items-start gap-2 text-sm font-medium text-[#374151]">
                                                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-[#2563eb]" />
                                                <span>{highlight}</span>
                                            </p>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className={`mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                                            plan.featured
                                                ? 'bg-[#2563eb] text-white hover:bg-[#1e40af]'
                                                : 'border border-[#dbeafe] bg-white text-[#1F2937] hover:border-[#93c5fd]'
                                        }`}
                                    >
                                        {plan.cta}
                                    </button>
                                </motion.article>
                            ))}
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    {...sectionMotion}
                    id="demo"
                    className="rpv-anchor rpv-gsap-section rpv-section rpv-section-transition mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8"
                >
                    <div className="rpv-section-card p-6 md:p-8">
                        <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-start">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1e40af]">Demo</p>
                                <h2 className="rpv-heading mt-3 text-2xl font-bold tracking-tight text-[#1F2937] md:text-3xl">
                                    What you get inside the application
                                </h2>
                                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6B7280] md:text-base">
                                    Restaurant is a daily operations workspace for takeaway and delivery teams. It centralizes tickets, timestamps, status flow, receipts, and menu control so service stays fast and consistent.
                                </p>

                                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {demoCards.map((card) => (
                                        <motion.article
                                            key={card.title}
                                            whileHover={{ y: -2 }}
                                            className="rpv-hover-lift rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-4"
                                        >
                                            <div className="inline-flex rounded-xl bg-white p-2.5 text-[#1e40af] shadow-sm">
                                                <card.icon size={17} />
                                            </div>
                                            <h3 className="mt-3 text-sm font-bold text-[#1F2937]">{card.title}</h3>
                                            <p className="mt-2 text-sm leading-6 text-[#6B7280]">{card.description}</p>
                                        </motion.article>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-[#dbeafe] bg-[#eff6ff] p-5 text-[#1F2937] shadow-sm">
                                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1e40af]">Live demo includes</p>
                                <div className="mt-4 space-y-3">
                                    <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium">Restaurant email login + master key</div>
                                    <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium">Waiter/Admin role switch with PIN rules</div>
                                    <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium">Reset code via email for secure recovery</div>
                                    <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium">Order lifecycle: New → Cooking → Ready → Delivered</div>
                                </div>
                                <div className="mt-5 flex flex-wrap gap-2">
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.985 }}
                                        onClick={scrollToAccess}
                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e40af]"
                                    >
                                        Login
                                        <ArrowRight size={16} />
                                    </motion.button>
                                    <button
                                        type="button"
                                        onClick={(event) => handleNavLinkClick(event, '#contact')}
                                        className="inline-flex items-center justify-center rounded-full border border-[#93c5fd] bg-white px-5 py-3 text-sm font-semibold text-[#1e40af] transition hover:border-[#2563eb]"
                                    >
                                        Book Demo Call
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                <motion.section {...sectionMotion} id="contact" className="rpv-anchor rpv-gsap-section rpv-section rpv-section-transition mx-auto max-w-[1280px] px-4 pb-14 sm:px-6 lg:px-8">
                    <div className="rpv-section-card p-6 md:p-8">
                        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1e40af]">Contact</p>
                                <h2 className="rpv-heading mt-2 text-2xl font-bold tracking-tight text-[#1F2937] md:text-3xl">
                                    Speak with our team
                                </h2>
                                <p className="rpv-copy mt-3 text-sm md:text-base">
                                    Tell us your restaurant setup and we will help you choose the right workflow, rollout plan, and access model.
                                </p>
                                <div className="mt-5 space-y-3">
                                    <div className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 text-sm">
                                        <p className="font-semibold text-[#1F2937]">Email support</p>
                                        <p className="mt-1 font-medium text-[#374151]">support@restaurantpov.com</p>
                                    </div>
                                    <div className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 text-sm">
                                        <p className="font-semibold text-[#1F2937]">Phone consultation</p>
                                        <p className="mt-1 font-medium text-[#374151]">+49 40 0000 000</p>
                                    </div>
                                    <div className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 text-sm">
                                        <p className="font-semibold text-[#1F2937]">Availability</p>
                                        <p className="mt-1 font-medium text-[#374151]">Mon–Sat, 09:00–20:00 CET</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[24px] border border-[#dbeafe] bg-[#eff6ff] p-4 sm:p-5">
                                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                                    <label className="block text-sm font-semibold text-[#1F2937]">
                                        Name
                                        <input className={inputClass(false)} type="text" placeholder="Your name" />
                                    </label>
                                    <label className="block text-sm font-semibold text-[#1F2937]">
                                        Restaurant
                                        <input className={inputClass(false)} type="text" placeholder="Restaurant name" />
                                    </label>
                                    <label className="block text-sm font-semibold text-[#1F2937]">
                                        Email
                                        <input className={inputClass(false)} type="email" placeholder="you@restaurant.com" />
                                    </label>
                                    <label className="block text-sm font-semibold text-[#1F2937]">
                                        Message
                                        <textarea className="rpv-textarea" placeholder="How can we help your team?" />
                                    </label>
                                    <button
                                        type="submit"
                                        className="inline-flex w-full items-center justify-center rounded-full bg-[#2563eb] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1e40af]"
                                    >
                                        Request Demo
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </motion.section>
            </main>

            <footer className="border-t border-[#dbeafe] bg-white/90 px-4 py-6 text-center text-sm font-medium text-[#6B7280] sm:px-6 lg:px-8">
                © {new Date().getFullYear()} Restaurant. Built for takeaway and delivery teams.
            </footer>
        </div>
    );
}
