import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { register, reset } from '../features/auth/authSlice';

const BENEFITS = [
    { label: 'Free to get started', desc: 'No credit card required' },
    { label: 'Expert-led courses',  desc: '500+ hours of content' },
    { label: 'AI mock interviews',  desc: 'Real-time feedback' },
    { label: 'Interview tracker',   desc: 'Never miss a follow-up' },
];

function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        password: '',
    });

    const { name, email, mobile, password } = formData;

    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { user, isLoading, isError, isSuccess, message } = useSelector(
        (state) => state.auth
    );

    useEffect(() => {
        if (isError) {
            alert(message);
        }

        if (isSuccess || user) {
            navigate('/');
        }

        dispatch(reset());
    }, [user, isError, isSuccess, message, navigate, dispatch]);

    const onChange = (e) => {
        setFormData((prevState) => ({
            ...prevState,
            [e.target.name]: e.target.value,
        }));
    };

    const onSubmit = (e) => {
        e.preventDefault();

        const userData = {
            name,
            email,
            mobile,
            password,
        };

        dispatch(register(userData));
    };

    return (
        <div className="min-h-screen flex font-sans">
            {/* ── Left brand panel ─────────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[54%] bg-gradient-hero relative overflow-hidden flex-col p-12">
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/[0.05]" />
                <div className="absolute bottom-10 -left-16 w-64 h-64 rounded-full bg-violet-600/30" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-auto">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                            </svg>
                        </div>
                        <span className="text-white font-bold text-xl tracking-tight">DreamJob</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center py-16">
                        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 mb-6 w-fit">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs text-white/80 font-medium">Free to get started</span>
                        </div>

                        <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-5">
                            Your career<br />starts <span className="text-indigo-200">here.</span>
                        </h1>
                        <p className="text-indigo-200 text-base leading-relaxed mb-10 max-w-sm">
                            Join thousands of professionals who landed roles at top companies using DreamJob.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {BENEFITS.map((b, i) => (
                                <div key={i} className="bg-white/[0.07] rounded-xl p-3.5 border border-white/10">
                                    <p className="text-white text-sm font-semibold mb-0.5">{b.label}</p>
                                    <p className="text-indigo-300 text-xs">{b.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-indigo-300/70 text-xs">
                        Already have an account?{' '}
                        <Link to="/login" className="text-white/80 hover:text-white font-semibold transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>

            {/* ── Right form panel ─────────────────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-[360px]">
                    <div className="lg:hidden flex items-center gap-2.5 mb-8">
                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                            </svg>
                        </div>
                        <span className="text-slate-900 font-bold text-lg tracking-tight">DreamJob</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-[26px] font-bold text-slate-900 tracking-tight mb-2">Create your account</h2>
                        <p className="text-slate-500 text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors underline-offset-2 hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    <form className="space-y-4" onSubmit={onSubmit}>
                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">Full name</label>
                            <input id="name" name="name" type="text" required autoComplete="name"
                                className="input-field text-sm" placeholder="Arjun Mehta"
                                value={name} onChange={onChange} />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                            <input id="email" name="email" type="email" required autoComplete="email"
                                className="input-field text-sm" placeholder="you@example.com"
                                value={email} onChange={onChange} />
                        </div>
                        <div>
                            <label htmlFor="mobile" className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile number</label>
                            <input id="mobile" name="mobile" type="tel" required autoComplete="tel"
                                className="input-field text-sm" placeholder="+91 98765 43210"
                                value={mobile} onChange={onChange} />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                            <input id="password" name="password" type="password" required autoComplete="new-password"
                                className="input-field text-sm" placeholder="At least 8 characters"
                                value={password} onChange={onChange} />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 shadow-primary hover:shadow-glow-violet disabled:opacity-60 transition-all duration-200 mt-1"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating account…
                                </>
                            ) : (
                                <>
                                    Create free account
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                </>
                            )}
                        </button>

                        <p className="text-center text-xs text-slate-400 pt-1">
                            By creating an account you agree to our{' '}
                            <span className="text-slate-500 cursor-pointer hover:text-primary-600 transition-colors">Terms of Service</span>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Register;
