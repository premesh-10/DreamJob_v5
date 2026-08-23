import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';

// ── Onboarding Status Tracker ─────────────────────────────────────────────────
function ApplicationStatusTracker({ application }) {
    const steps = [
        { key: 'applied', label: 'Applied', icon: '📥', desc: 'Your application has been received.' },
        { key: 'verifying', label: 'Verifying', icon: '🔍', desc: 'Our team is reviewing your profile.' },
        { key: 'approved', label: 'Approved', icon: '✅', desc: 'Welcome aboard! You are now a seller.' },
    ];

    const isRejected = application.status === 'rejected';
    const currentIdx = steps.findIndex(s => s.key === application.status);

    return (
        <div className="min-h-screen flex font-sans">
            {/* Left Panel */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 flex-col justify-center p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-72 h-72 bg-violet-600/20 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-white font-black">DJ</span>
                        </div>
                        <span className="text-white font-bold text-lg">DreamJob Seller Hub</span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-4">Your application<br />is in progress 🚀</h1>
                    <p className="text-indigo-200 text-lg">We review every seller application carefully to maintain quality. Thank you for your patience!</p>
                </div>
            </div>

            {/* Right Panel */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-slate-900">Application Status</h2>
                        <p className="text-slate-500 mt-1">Applied for: <span className="font-semibold text-slate-700">{application.contentType}</span></p>
                        {application.targetedCourse && (
                            <p className="text-slate-500 text-sm">Expertise: {application.targetedCourse}</p>
                        )}
                    </div>

                    {isRejected ? (
                        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                            <div className="text-5xl mb-4">❌</div>
                            <h3 className="text-xl font-bold text-rose-800 mb-2">Application Not Approved</h3>
                            <p className="text-rose-600 text-sm leading-relaxed">
                                Unfortunately your seller application was not approved at this time.
                                Please contact <a href="mailto:support@dreamjob.com" className="underline font-semibold">support@dreamjob.com</a> for more information.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {steps.map((step, idx) => {
                                const isDone = currentIdx > idx || application.status === step.key;
                                const isActive = application.status === step.key;
                                const isFuture = currentIdx < idx;

                                return (
                                    <div key={step.key} className="flex items-start gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all ${
                                                isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-300' :
                                                isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                                                'bg-slate-100 border-slate-200 text-slate-400'
                                            }`}>
                                                {isDone && !isActive ? '✓' : step.icon}
                                            </div>
                                            {idx < steps.length - 1 && (
                                                <div className={`w-0.5 h-10 mt-1 ${isDone && currentIdx > idx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                            )}
                                        </div>
                                        <div className={`pt-2.5 ${isFuture ? 'opacity-40' : ''}`}>
                                            <p className={`font-bold ${isActive ? 'text-indigo-700' : isDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                {step.label}
                                                {isActive && <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Current</span>}
                                            </p>
                                            <p className={`text-sm mt-0.5 ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>{step.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {application.status === 'approved' && (
                        <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                            <p className="text-emerald-700 font-semibold mb-3">Your account has been approved! 🎉</p>
                            <Link to="/seller/login"
                                className="inline-block w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition shadow-lg">
                                Login to Seller Hub →
                            </Link>
                        </div>
                    )}

                    {(application.status === 'applied' || application.status === 'verifying') && (
                        <div className="mt-8 space-y-4">
                            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
                                <p>⏱ Approval typically takes <strong>24–48 hours</strong>. You'll be notified once your status changes.</p>
                            </div>
                            <Link to="/"
                                className="inline-block w-full py-3 bg-white border-2 border-indigo-100 text-indigo-700 text-center font-bold rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition">
                                ← Back to Main Platform
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Application Form ──────────────────────────────────────────────────────────
function SellerRegister() {
    const { user } = useSelector(state => state.auth);
    const [step, setStep] = useState(user ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [existingApplication, setExistingApplication] = useState(null);
    const [error, setError] = useState('');
    const [accountData, setAccountData] = useState({ name: '', email: '', mobile: '', password: '' });
    const [sellerData, setSellerData] = useState({ contentType: 'Courses', targetedCourse: '' });
    const navigate = useNavigate();

    // Auto-advance if user state changes after mount
    useEffect(() => {
        if (user && step === 1) setStep(2);
    }, [user]);

    // Check if logged-in user already has an application
    useEffect(() => {
        const checkStatus = async () => {
            if (!user) { setCheckingStatus(false); return; }
            try {
                const { data } = await api.get('/sellers/my-status');
                setExistingApplication(data.data);
            } catch { /* no application */ }
            finally { setCheckingStatus(false); }
        };
        checkStatus();
    }, [user]);

    const handleAccount = e => setAccountData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleSeller = e => setSellerData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleStep1 = async e => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (!accountData.name || !accountData.email || !accountData.password) {
                setError('Please fill all required fields');
                setLoading(false);
                return;
            }
            setStep(2);
        } catch (err) {
            setError(err?.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSubmit = async e => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (!user) {
                // Step 1: Register account
                const regRes = await api.post('/auth/register', {
                    ...accountData,
                    experience: 0,
                    gender: 'Prefer not to say',
                    qualification: 'Not specified',
                    country: 'India'
                });

                const token = regRes.data.token;
                localStorage.setItem('user', JSON.stringify({ ...regRes.data.user, token }));
            }

            // Step 2: Apply as seller
            const { data } = await api.post('/sellers/apply', sellerData);
            setExistingApplication(data.data);
        } catch (err) {
            setError(err?.response?.data?.message || 'Application failed. You may have already applied or email exists.');
        } finally {
            setLoading(false);
        }
    };

    // Show loading spinner while checking
    if (checkingStatus) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Show status tracker if user already has an application
    if (existingApplication) {
        return <ApplicationStatusTracker application={existingApplication} />;
    }

    return (
        <div className="min-h-screen flex font-sans">
            {/* Left Panel */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 flex-col justify-center p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-72 h-72 bg-violet-600/20 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-white font-black">DJ</span>
                        </div>
                        <span className="text-white font-bold text-lg">DreamJob Seller Hub</span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-4">Start your<br />teaching journey 🎯</h1>
                    <p className="text-indigo-200 text-lg mb-8">Create your account and apply to join as a seller. Share your expertise with thousands of learners.</p>

                    {/* Steps */}
                    <div className="space-y-4">
                        {(user ? ['Submit seller application', 'Admin approval (24–48 hrs)', 'Start selling!'] : ['Create your account', 'Submit seller application', 'Admin approval (24–48 hrs)', 'Start selling!']).map((s, i) => {
                            const stepNumber = user ? i + 2 : i + 1;
                            const isActive = user ? step >= 2 : step > i;
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isActive ? 'bg-emerald-400 text-white' : 'bg-white/20 text-white'}`}>{stepNumber}</div>
                                    <span className={`text-sm ${isActive ? 'text-white font-medium' : 'text-indigo-300'}`}>{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
                <div className="w-full max-w-md">
                    {/* Step indicators */}
                    {!user && (
                        <div className="flex items-center gap-2 mb-8">
                            {[1, 2].map(s => (
                                <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${step >= s ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                            ))}
                        </div>
                    )}

                    <div className="mb-6">
                        <h2 className="text-2xl font-black text-slate-900">{step === 1 ? 'Create Account' : 'Seller Details'}</h2>
                        <p className="text-slate-500 mt-1">{step === 1 ? 'Step 1 of 2 — Your account info' : (user ? 'Tell us about your content' : 'Step 2 of 2 — Tell us about your content')}</p>
                    </div>

                    {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

                    {step === 1 && !user ? (
                        <form onSubmit={handleStep1} className="space-y-4">
                            {[
                                { name: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe' },
                                { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
                                { name: 'mobile', label: 'Mobile (optional)', type: 'text', placeholder: '+91 9999999999' },
                                { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
                            ].map(f => (
                                <div key={f.name}>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{f.label}</label>
                                    <input type={f.type} name={f.name} value={accountData[f.name]} onChange={handleAccount}
                                        required={f.name !== 'mobile'}
                                        placeholder={f.placeholder}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                                </div>
                            ))}
                            <button type="submit" disabled={loading}
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition shadow-lg shadow-indigo-500/30 disabled:opacity-60">
                                Continue →
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleFinalSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Content Type</label>
                                <select name="contentType" value={sellerData.contentType} onChange={handleSeller}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none transition">
                                    <option value="Courses">Courses Only</option>
                                    <option value="Interviews">Interview Coaching Only</option>
                                    <option value="Both">Both Courses & Interviews</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Your Expertise / Subject</label>
                                <input type="text" name="targetedCourse" value={sellerData.targetedCourse} onChange={handleSeller}
                                    placeholder="e.g. Python, Data Science, React, System Design"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            <div className="flex gap-3">
                                {!user && (
                                    <button type="button" onClick={() => setStep(1)}
                                        className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">
                                        ← Back
                                    </button>
                                )}
                                <button type="submit" disabled={loading}
                                    className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition shadow-lg disabled:opacity-60">
                                    {loading ? 'Submitting...' : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    )}

                    {!user && (
                        <p className="mt-6 text-center text-sm text-slate-500">
                            Already a seller? <Link to="/seller/login" className="text-indigo-600 font-semibold hover:underline">Sign in</Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SellerRegister;
