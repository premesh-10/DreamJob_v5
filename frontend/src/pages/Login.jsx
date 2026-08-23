import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { login, reset } from '../features/auth/authSlice';

const FEATURES = [
    { icon: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z', label: 'AI Mock Interviews', desc: 'Real-time feedback from industry experts' },
    { icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25', label: 'Expert Courses', desc: '500+ hours of structured learning' },
    { icon: 'M9 12h3.75M9 15h3.75m-7.5 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z', label: 'Interview Tracker', desc: 'Track every application stage' },
];

function Login() {
    const [formData,  setFormData]  = useState({ email: '', password: '' });
    const [errorMsg,  setErrorMsg]  = useState('');
    const [searchParams] = useSearchParams();

    const dispatch  = useDispatch();
    const navigate  = useNavigate();
    const { user, isLoading, isError, isSuccess, message } = useSelector(s => s.auth);

    useEffect(() => {
        if (searchParams.get('blocked') === '1')
            setErrorMsg('Your account has been suspended. Contact support for assistance.');
    }, [searchParams]);

    useEffect(() => {
        if (isError)           setErrorMsg(message);
        if (isSuccess || user) navigate('/');
        dispatch(reset());
    }, [user, isError, isSuccess, message, navigate, dispatch]);

    const onChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const onSubmit = e => { e.preventDefault(); setErrorMsg(''); dispatch(login(formData)); };

    return (
        <div className="min-h-screen flex font-sans">

            {/* ── Left: Brand panel ─────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[54%] bg-gradient-hero relative overflow-hidden flex-col p-12">
                {/* Background shapes */}
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/[0.05]" />
                <div className="absolute top-1/2 -right-16 w-64 h-64 rounded-full bg-violet-600/30" />
                <div className="absolute bottom-10 left-1/4 w-48 h-48 rounded-full bg-indigo-500/20" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

                <div className="relative z-10 flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-auto">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                            </svg>
                        </div>
                        <span className="text-white font-bold text-xl tracking-tight">DreamJob</span>
                    </div>

                    {/* Hero text */}
                    <div className="flex-1 flex flex-col justify-center py-16">
                        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 mb-6 w-fit">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs text-white/80 font-medium">Trusted by 10,000+ candidates</span>
                        </div>

                        <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-5">
                            Land your<br />
                            dream job<br />
                            <span className="text-indigo-200">this year.</span>
                        </h1>
                        <p className="text-indigo-200 text-base leading-relaxed mb-10 max-w-sm">
                            The all-in-one career prep platform. From courses to mock interviews — everything you need to crack the offer.
                        </p>

                        <div className="space-y-3">
                            {FEATURES.map((f, i) => (
                                <div key={i} className="flex items-center gap-3 bg-white/[0.07] backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                            <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-semibold leading-tight">{f.label}</p>
                                        <p className="text-indigo-300 text-xs mt-0.5">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Testimonial */}
                    <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl p-5 border border-white/10">
                        <div className="flex gap-1 mb-3">
                            {[...Array(5)].map((_, i) => (
                                <svg key={i} className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                </svg>
                            ))}
                        </div>
                        <p className="text-indigo-100 text-sm leading-relaxed italic mb-3">
                            "Cracked FAANG in 8 weeks. The mock interviews here were harder than the real thing — which is exactly what I needed."
                        </p>
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold">P</div>
                            <div>
                                <p className="text-white text-xs font-semibold">Priya Sharma</p>
                                <p className="text-indigo-400 text-xs">Software Engineer · Google</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right: Form panel ─────────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-[380px]">

                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2.5 mb-10">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
                            <svg className="w-[15px] h-[15px] text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                            </svg>
                        </div>
                        <span className="font-bold text-slate-900 text-lg">DreamJob</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-[26px] font-bold text-slate-900 tracking-tight mb-2">Welcome back</h2>
                        <p className="text-slate-500 text-sm">
                            New here?{' '}
                            <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors underline-offset-2 hover:underline">
                                Create a free account
                            </Link>
                        </p>
                    </div>

                    {/* Error */}
                    {errorMsg && (
                        <div className={`mb-5 p-3.5 rounded-xl border text-sm leading-snug ${
                            errorMsg.toLowerCase().includes('suspended')
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}>
                            <p className="font-semibold mb-0.5">
                                {errorMsg.toLowerCase().includes('suspended') ? 'Account suspended' : 'Sign-in failed'}
                            </p>
                            <p className="opacity-80 font-normal">{errorMsg}</p>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={onSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                            <input
                                id="email" name="email" type="email" required autoComplete="email"
                                className="input-field text-sm"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={onChange}
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                            <input
                                id="password" name="password" type="password" required autoComplete="current-password"
                                className="input-field text-sm"
                                placeholder="Your password"
                                value={formData.password}
                                onChange={onChange}
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 shadow-primary hover:shadow-glow-violet disabled:opacity-60 transition-all duration-200 mt-1"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    Sign in
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-slate-400">
                        By signing in you agree to our{' '}
                        <span className="text-slate-500 cursor-pointer hover:text-primary-600 transition-colors">Terms of Service</span>
                    </p>

                    {/* Divider + signup nudge */}
                    <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                        <p className="text-sm text-slate-500">Don't have an account?</p>
                        <Link to="/register" className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-soft">
                            Create free account
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
