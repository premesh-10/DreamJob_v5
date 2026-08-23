import { useState, useEffect } from 'react';
import api from '../../lib/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

// ─── Reusable field components ────────────────────────────────────────────────

function Toggle({ label, value, onChange, note, disabled }) {
    return (
        <div className={`flex items-start justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 leading-snug">{label}</p>
                {note && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{note}</p>}
            </div>
            <button type="button" onClick={() => onChange(!value)}
                className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${value ? 'bg-primary-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

function Field({ label, note, children }) {
    return (
        <div className="py-3.5 border-b border-slate-100 last:border-0">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
            {children}
            {note && <p className="text-xs text-slate-400 mt-1.5">{note}</p>}
        </div>
    );
}

function SectionCard({ children }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card divide-y divide-slate-100 px-6">
            {children}
        </div>
    );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
    { id: 'general',      label: 'General',              icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'features',     label: 'Features',             icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { id: 'access',       label: 'Access & Registration', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { id: 'moderation',   label: 'Moderation',           icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'payments',     label: 'Payments',             icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { id: 'notifications',label: 'Notifications',        icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { id: 'social',       label: 'Social & Legal',       icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { id: 'maintenance',  label: 'Maintenance',          icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

// ─── Default values (must match the Settings model defaults) ─────────────────
const DEFAULTS = {
    siteName: 'DreamJob', tagline: 'Land your dream job with confidence',
    supportEmail: '', contactPhone: '',
    coursesEnabled: true, practiceTestsEnabled: true, mockInterviewsEnabled: true,
    webinarsEnabled: true, hubEnabled: true, subscriptionsEnabled: true,
    allowUserRegistrations: true, allowSellerRegistrations: true,
    allowGoogleLogin: true, requireEmailVerification: false,
    autoApproveCourses: false, autoApproveWebinars: true,
    autoApproveExperiences: true, allowAnonymousReviews: false,
    paymentMode: 'live', defaultCurrency: 'INR', platformCommissionPercent: 20,
    emailNotificationsEnabled: true, smsNotificationsEnabled: false,
    twitterUrl: '', linkedinUrl: '', instagramUrl: '', youtubeUrl: '',
    termsUrl: '', privacyUrl: '',
    maintenanceMode: false, maintenanceMessage: "We're currently performing scheduled maintenance. We'll be back shortly.",
};

function AdminSettings() {
    const [settings, setSettings] = useState(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        api.get('/admin/site-settings')
            .then(r => setSettings({ ...DEFAULTS, ...r.data.data }))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

    const save = async () => {
        setSaving(true); setSaved(false); setError('');
        try {
            const { data } = await api.put('/admin/site-settings', settings);
            setSettings({ ...DEFAULTS, ...data.data });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to save settings');
        } finally { setSaving(false); }
    };

    const inp = "w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white";

    if (loading) return (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading settings...</span>
            </div>

    );

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    iconBg="from-slate-700 to-slate-900"
                    title="System Settings"
                    subtitle="Global website controls — changes apply instantly without redeployment"
                    actions={
                        <button onClick={save} disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 disabled:opacity-60 transition-all shadow-primary">
                            {saving ? (
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    }
                />

                {/* Toast */}
                {saved && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        System settings saved successfully.
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Maintenance mode warning banner */}
                {settings.maintenanceMode && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-800">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm font-semibold">Maintenance mode is currently <span className="text-amber-900">ACTIVE</span> — the platform is not accessible to users.</span>
                    </div>
                )}

                {/* Layout: tab sidebar + content */}
                <div className="flex gap-6 items-start">
                    {/* Tab sidebar */}
                    <div className="w-52 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-card p-2 space-y-0.5">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                                    activeTab === tab.id
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={tab.icon} />
                                </svg>
                                <span className="truncate">{tab.label}</span>
                                {tab.id === 'maintenance' && settings.maintenanceMode && (
                                    <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content panel */}
                    <div className="flex-1 min-w-0 space-y-4">

                        {/* ── General ─────────────────────────────────────── */}
                        {activeTab === 'general' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">General Information</h2>
                                    <span className="text-xs text-slate-400 font-medium">Site identity &amp; contact details</span>
                                </div>
                                <SectionCard>
                                    <Field label="Site Name" note="Displayed across the platform and in email subjects">
                                        <input className={inp} value={settings.siteName} onChange={e => set('siteName', e.target.value)} placeholder="DreamJob" />
                                    </Field>
                                    <Field label="Tagline" note="Short description shown on the homepage and auth pages">
                                        <input className={inp} value={settings.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Land your dream job with confidence" />
                                    </Field>
                                    <Field label="Support Email" note="Displayed on error pages and in notification footers">
                                        <input type="email" className={inp} value={settings.supportEmail} onChange={e => set('supportEmail', e.target.value)} placeholder="support@dreamjob.in" />
                                    </Field>
                                    <Field label="Contact Phone" note="Optional — shown on the contact/support page">
                                        <input type="tel" className={inp} value={settings.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+91 98765 43210" />
                                    </Field>
                                </SectionCard>
                            </>
                        )}

                        {/* ── Features ────────────────────────────────────── */}
                        {activeTab === 'features' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">Feature Flags</h2>
                                    <span className="text-xs text-slate-400 font-medium">Master switches for platform modules</span>
                                </div>
                                <SectionCard>
                                    <Toggle label="Courses" value={settings.coursesEnabled} onChange={v => set('coursesEnabled', v)}
                                        note="Allow users to browse, purchase, and study courses" />
                                    <Toggle label="Practice Tests" value={settings.practiceTestsEnabled} onChange={v => set('practiceTestsEnabled', v)}
                                        note="Enable the practice test module for all users" />
                                    <Toggle label="Mock Interviews" value={settings.mockInterviewsEnabled} onChange={v => set('mockInterviewsEnabled', v)}
                                        note="Enable booking and conducting live mock interviews" />
                                    <Toggle label="Webinars" value={settings.webinarsEnabled} onChange={v => set('webinarsEnabled', v)}
                                        note="Enable the live webinar registration and streaming platform" />
                                    <Toggle label="Interview Hub" value={settings.hubEnabled} onChange={v => set('hubEnabled', v)}
                                        note="Enable the community hub — company reviews, experiences, and rewards" />
                                    <Toggle label="Subscriptions" value={settings.subscriptionsEnabled} onChange={v => set('subscriptionsEnabled', v)}
                                        note="Allow users to purchase subscription plans (Ruby / Platinum)" />
                                </SectionCard>
                            </>
                        )}

                        {/* ── Access & Registration ────────────────────────── */}
                        {activeTab === 'access' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">Access &amp; Registration</h2>
                                    <span className="text-xs text-slate-400 font-medium">Control who can sign up and how</span>
                                </div>
                                <SectionCard>
                                    <Toggle label="Allow User Registrations" value={settings.allowUserRegistrations} onChange={v => set('allowUserRegistrations', v)}
                                        note="When off, new users cannot create accounts (existing accounts still work)" />
                                    <Toggle label="Allow Interviewer (Seller) Registrations" value={settings.allowSellerRegistrations} onChange={v => set('allowSellerRegistrations', v)}
                                        note="When off, new interviewers cannot apply to join the platform" />
                                    <Toggle label="Allow Google / OAuth Login" value={settings.allowGoogleLogin} onChange={v => set('allowGoogleLogin', v)}
                                        note="Enable Sign in with Google on the login and register pages" />
                                    <Toggle label="Require Email Verification" value={settings.requireEmailVerification} onChange={v => set('requireEmailVerification', v)}
                                        note="New accounts must verify their email before accessing the platform" />
                                </SectionCard>
                            </>
                        )}

                        {/* ── Moderation ───────────────────────────────────── */}
                        {activeTab === 'moderation' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">Content Moderation</h2>
                                    <span className="text-xs text-slate-400 font-medium">Control what gets published automatically</span>
                                </div>
                                <SectionCard>
                                    <Toggle label="Auto-approve Courses" value={settings.autoApproveCourses} onChange={v => set('autoApproveCourses', v)}
                                        note="When off, courses submitted by sellers require admin review before going live" />
                                    <Toggle label="Auto-approve Webinars" value={settings.autoApproveWebinars} onChange={v => set('autoApproveWebinars', v)}
                                        note="When off, new webinars enter a pending-approval queue (controlled by the Webinar moderation setting)" />
                                    <Toggle label="Auto-approve Interview Experiences" value={settings.autoApproveExperiences} onChange={v => set('autoApproveExperiences', v)}
                                        note="When off, user-submitted experiences require moderation before appearing in the Hub" />
                                    <Toggle label="Allow Anonymous Reviews" value={settings.allowAnonymousReviews} onChange={v => set('allowAnonymousReviews', v)}
                                        note="Let users submit feedback and reviews without showing their name" />
                                </SectionCard>
                            </>
                        )}

                        {/* ── Payments ─────────────────────────────────────── */}
                        {activeTab === 'payments' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">Payments &amp; Commission</h2>
                                    <span className="text-xs text-slate-400 font-medium">Gateway mode and platform revenue settings</span>
                                </div>
                                <SectionCard>
                                    <Field label="Payment Gateway Mode" note="Switch between Cashfree test and live environments">
                                        <div className="flex gap-3 mt-1">
                                            {['test', 'live'].map(mode => (
                                                <button key={mode} type="button" onClick={() => set('paymentMode', mode)}
                                                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize border-2 transition-all ${
                                                        settings.paymentMode === mode
                                                            ? mode === 'live'
                                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                                : 'border-amber-500 bg-amber-50 text-amber-700'
                                                            : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}>
                                                    {mode === 'live' ? (
                                                        <span className="flex items-center justify-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                                            Live
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                                            Test
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        {settings.paymentMode === 'test' && (
                                            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                Test mode is active — no real transactions will be processed.
                                            </p>
                                        )}
                                    </Field>
                                    <Field label="Default Currency" note="Currency used for pricing and display across the platform">
                                        <select className={inp} value={settings.defaultCurrency} onChange={e => set('defaultCurrency', e.target.value)}>
                                            <option value="INR">INR — Indian Rupee (₹)</option>
                                            <option value="USD">USD — US Dollar ($)</option>
                                            <option value="GBP">GBP — British Pound (£)</option>
                                            <option value="EUR">EUR — Euro (€)</option>
                                        </select>
                                    </Field>
                                    <Field label="Platform Commission %" note="Percentage deducted from seller/interviewer earnings on each transaction">
                                        <div className="flex items-center gap-3">
                                            <input type="number" min={0} max={100} step={1} className={`${inp} w-32`}
                                                value={settings.platformCommissionPercent}
                                                onChange={e => set('platformCommissionPercent', Number(e.target.value))} />
                                            <span className="text-sm text-slate-500">%</span>
                                            <span className="text-xs text-slate-400">Sellers receive {100 - settings.platformCommissionPercent}% of each payment</span>
                                        </div>
                                    </Field>
                                </SectionCard>
                            </>
                        )}

                        {/* ── Notifications ────────────────────────────────── */}
                        {activeTab === 'notifications' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">Notifications</h2>
                                    <span className="text-xs text-slate-400 font-medium">Platform-wide notification channels</span>
                                </div>
                                <SectionCard>
                                    <Toggle label="Email Notifications" value={settings.emailNotificationsEnabled} onChange={v => set('emailNotificationsEnabled', v)}
                                        note="Master switch for all transactional emails (confirmations, reminders, certificates, dispute updates)" />
                                    <Toggle label="SMS Notifications" value={settings.smsNotificationsEnabled} onChange={v => set('smsNotificationsEnabled', v)}
                                        note="Send SMS alerts for bookings and reminders (requires SMTP/SMS provider configuration)" />
                                </SectionCard>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
                                    <p className="font-medium text-slate-700 mb-1">SMTP Configuration</p>
                                    <p>Email delivery credentials (SMTP host, port, user, password) are configured via environment variables on the server and cannot be changed from this panel — contact your DevOps team to update them.</p>
                                </div>
                            </>
                        )}

                        {/* ── Social & Legal ───────────────────────────────── */}
                        {activeTab === 'social' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">Social &amp; Legal</h2>
                                    <span className="text-xs text-slate-400 font-medium">Links shown in the footer and legal pages</span>
                                </div>
                                <SectionCard>
                                    <Field label="Twitter / X URL">
                                        <input type="url" className={inp} value={settings.twitterUrl} onChange={e => set('twitterUrl', e.target.value)} placeholder="https://twitter.com/dreamjob" />
                                    </Field>
                                    <Field label="LinkedIn URL">
                                        <input type="url" className={inp} value={settings.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/company/dreamjob" />
                                    </Field>
                                    <Field label="Instagram URL">
                                        <input type="url" className={inp} value={settings.instagramUrl} onChange={e => set('instagramUrl', e.target.value)} placeholder="https://instagram.com/dreamjob" />
                                    </Field>
                                    <Field label="YouTube URL">
                                        <input type="url" className={inp} value={settings.youtubeUrl} onChange={e => set('youtubeUrl', e.target.value)} placeholder="https://youtube.com/@dreamjob" />
                                    </Field>
                                    <Field label="Terms of Service URL" note="Linked in registration, purchase flows, and the footer">
                                        <input type="url" className={inp} value={settings.termsUrl} onChange={e => set('termsUrl', e.target.value)} placeholder="https://dreamjob.in/terms" />
                                    </Field>
                                    <Field label="Privacy Policy URL" note="Linked in registration, emails, and the footer">
                                        <input type="url" className={inp} value={settings.privacyUrl} onChange={e => set('privacyUrl', e.target.value)} placeholder="https://dreamjob.in/privacy" />
                                    </Field>
                                </SectionCard>
                            </>
                        )}

                        {/* ── Maintenance ──────────────────────────────────── */}
                        {activeTab === 'maintenance' && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-bold text-slate-900">Maintenance Mode</h2>
                                    <span className="text-xs text-slate-400 font-medium">Take the platform offline for all non-admin users</span>
                                </div>

                                {settings.maintenanceMode && (
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-800">
                                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div>
                                            <p className="font-bold text-sm">Platform is currently in Maintenance Mode</p>
                                            <p className="text-xs mt-0.5 text-red-700">All non-admin users are seeing the maintenance page right now.</p>
                                        </div>
                                    </div>
                                )}

                                <SectionCard>
                                    <Toggle label="Enable Maintenance Mode" value={settings.maintenanceMode} onChange={v => set('maintenanceMode', v)}
                                        note="When active, only admin users can access the platform. All other visitors see the maintenance message below." />
                                    <Field label="Maintenance Message" note="Shown to users visiting the site during maintenance">
                                        <textarea rows={4} className={`${inp} resize-none`} value={settings.maintenanceMessage}
                                            onChange={e => set('maintenanceMessage', e.target.value)}
                                            placeholder="We're currently performing scheduled maintenance. We'll be back shortly." />
                                    </Field>
                                </SectionCard>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 space-y-1">
                                    <p className="font-medium text-slate-700">How it works</p>
                                    <p>While maintenance mode is on, all routes redirect non-admin visitors to a maintenance page. Admin accounts (role: admin, super_admin) can still log in and access the full panel.</p>
                                    <p>Remember to turn this off after your maintenance window is complete.</p>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>

        </>
    );
}

export default AdminSettings;
