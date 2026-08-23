import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login, reset } from '../../features/auth/authSlice';

function SellerLogin() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await dispatch(login(formData)).unwrap();
            const role = result?.user?.role;
            if (role !== 'seller' && role !== 'admin' && role !== 'super_admin') {
                setError('This account does not have seller access. Apply to become a seller first.');
                setLoading(false);
                return;
            }
            navigate('/seller');
        } catch (err) {
            setError(err || 'Invalid credentials');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-sans">
            {/* Left Panel */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 flex-col justify-between p-12 relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-violet-600/20 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-white font-black">DJ</span>
                        </div>
                        <span className="text-white font-bold text-lg tracking-wide">DreamJob Seller Hub</span>
                    </div>

                    <h1 className="text-4xl font-black text-white leading-tight mb-4">
                        Teach. Earn.<br />Grow. 🚀
                    </h1>
                    <p className="text-indigo-200 text-lg mb-10">
                        Join thousands of instructors sharing knowledge and building their career.
                    </p>

                    <div className="space-y-5">
                        {[
                            { icon: '💰', title: 'Earn on Your Terms', desc: 'Set your own prices for courses & interview sessions' },
                            { icon: '🎓', title: 'Reach More Students', desc: 'Access our growing learner community' },
                            { icon: '📊', title: 'Track Your Growth', desc: 'Real-time revenue analytics and insights' },
                        ].map(f => (
                            <div key={f.title} className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl">{f.icon}</div>
                                <div>
                                    <p className="text-white font-semibold text-sm">{f.title}</p>
                                    <p className="text-indigo-300 text-sm">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-indigo-400 text-sm relative z-10">© 2025 DreamJob Platform</p>
            </div>

            {/* Right Panel */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-slate-900">Seller Login</h2>
                        <p className="text-slate-500 mt-2">Sign in to your seller account</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} required
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-slate-900"
                                placeholder="you@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} required
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-slate-900"
                                placeholder="••••••••" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition shadow-lg shadow-indigo-500/30 disabled:opacity-60">
                            {loading ? 'Signing in...' : 'Sign in to Seller Hub'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Not a seller yet?{' '}
                        <Link to="/seller/register" className="text-indigo-600 font-semibold hover:underline">Apply now</Link>
                    </p>
                    <p className="mt-2 text-center text-sm text-slate-500">
                        <Link to="/login" className="text-slate-400 hover:text-slate-600">Back to main login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default SellerLogin;
