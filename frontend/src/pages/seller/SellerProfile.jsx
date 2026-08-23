import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '../../features/auth/authSlice';
import api from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

function getAvatarUrl(pic) {
    if (!pic) return null;
    if (pic.startsWith('http')) return pic;
    return `${API_BASE}${pic}`;
}

function SellerProfile() {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();

    const [seller, setSeller] = useState(null);
    const [form, setForm] = useState({
        bio: '', expertise: '',
        socialLinks: { linkedin: '', github: '', website: '' }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [verifUploading, setVerifUploading] = useState(false);
    const fileInputRef = useRef(null);
    const verifInputRef = useRef(null);

    // Sync avatarPreview when Redux user changes
    useEffect(() => {
        if (user) {
            setAvatarPreview(getAvatarUrl(user.profilePic));
        }
    }, [user]);

    useEffect(() => {
        api.get('/sellers/me').then(r => {
            const d = r.data.data;
            setSeller(d);
            setForm({
                bio: d.bio || '',
                expertise: (d.expertise || []).join(', '),
                socialLinks: {
                    linkedin: d.socialLinks?.linkedin || '',
                    github: d.socialLinks?.github || '',
                    website: d.socialLinks?.website || ''
                }
            });

            // Initial avatar preview is handled by Redux user effect
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleSocial = e => setForm(p => ({ ...p, socialLinks: { ...p.socialLinks, [e.target.name]: e.target.value } }));

    const save = async e => {
        e.preventDefault(); setSaving(true); setMsg(''); setError('');
        try {
            const payload = {
                ...form,
                expertise: form.expertise.split(',').map(s => s.trim()).filter(Boolean)
            };
            await api.put('/sellers/me', payload);
            setMsg('Profile updated successfully!');
            setTimeout(() => setMsg(''), 3000);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save profile');
        } finally { setSaving(false); }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Immediate preview
        setAvatarPreview(URL.createObjectURL(file));

        setAvatarLoading(true); setMsg(''); setError('');
        try {
            const formPayload = new FormData();
            formPayload.append('avatar', file);
            const { data } = await api.post('/users/profile/avatar', formPayload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            dispatch(setUser(data.data)); // Updates sidebar instantly
            setMsg('Profile picture updated!');
            setTimeout(() => setMsg(''), 3000);
        } catch (err) {
            setAvatarPreview(getAvatarUrl(user?.profilePic));
            setError(err?.response?.data?.message || 'Failed to upload image');
        } finally { setAvatarLoading(false); }
    };

    const handleRemoveAvatar = async () => {
        if (!window.confirm('Remove profile picture?')) return;
        setAvatarLoading(true);
        try {
            await api.delete('/users/profile/avatar');
            dispatch(setUser({ ...user, profilePic: '' }));
            setMsg('Profile picture removed.');
            setTimeout(() => setMsg(''), 3000);
        } catch (err) {
            setError('Failed to remove picture.');
        } finally { setAvatarLoading(false); }
    };

    const statusColors = {
        pending: 'bg-yellow-100 text-yellow-700',
        approved: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-red-100 text-red-700'
    };

    const verifStatusColors = {
        unverified: 'bg-slate-100 text-slate-600',
        pending: 'bg-amber-100 text-amber-700',
        verified: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-red-100 text-red-700',
    };

    const handleVerificationUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setVerifUploading(true); setMsg(''); setError('');
        try {
            const formPayload = new FormData();
            formPayload.append('document', file);
            const { data } = await api.post('/sellers/me/verification', formPayload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSeller(s => ({ ...s, verification: data.data }));
            setMsg('Verification document submitted — pending admin review.');
            setTimeout(() => setMsg(''), 4000);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to upload document');
        } finally { setVerifUploading(false); }
    };

    const initials = seller?.user?.name?.charAt(0)?.toUpperCase() || '?';

    if (loading) return (
            <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>

    );

    return (
        <>
            <div className="max-w-3xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Profile Settings</h1>
                    <p className="text-slate-500 mt-1">Manage your seller profile and public information</p>
                </div>

                {msg && <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">✓ {msg}</div>}
                {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">⚠ {error}</div>}

                {/* Avatar + Account Info Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left">
                        {/* Avatar with upload */}
                        <div className="relative flex-shrink-0">
                            <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white/30 overflow-hidden flex items-center justify-center text-white text-2xl font-black shadow-lg">
                                {avatarLoading ? (
                                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                ) : avatarPreview ? (
                                    <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover"
                                        onError={() => setAvatarPreview(null)} />
                                ) : initials}
                            </div>
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarLoading}
                                className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-violet-50 transition border-2 border-violet-200"
                                title="Change photo">
                                <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                        </div>

                        <div className="text-white flex-1 min-w-0 text-center sm:text-left">
                            <p className="font-black text-lg truncate">{seller?.user?.name}</p>
                            <p className="text-white/70 text-sm truncate">{seller?.user?.email}</p>
                            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarLoading}
                                    className="text-xs bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full transition font-medium">
                                    {avatarPreview ? '📷 Change Photo' : '📷 Upload Photo'}
                                </button>
                                {avatarPreview && (
                                    <button type="button" onClick={handleRemoveAvatar} disabled={avatarLoading}
                                        className="text-xs bg-white/10 hover:bg-red-500/40 text-white/80 px-3 py-1 rounded-full transition font-medium">
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Read-only account info */}
                    <div className="p-6">
                        <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider text-slate-400">Account Information</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            {[
                                { label: 'Name', value: seller?.user?.name },
                                { label: 'Email', value: seller?.user?.email },
                                { label: 'Content Type', value: seller?.contentType },
                                {
                                    label: 'Application Status',
                                    value: <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[seller?.status]}`}>{seller?.status}</span>
                                },
                            ].map(item => (
                                <div key={item.label}>
                                    <p className="text-slate-400 text-xs mb-0.5">{item.label}</p>
                                    <p className="font-semibold text-slate-800">{item.value || '—'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Interviewer identity verification */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="font-bold text-slate-900">🪪 Interviewer Identity Verification</h2>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${verifStatusColors[seller?.verification?.status || 'unverified']}`}>
                            {seller?.verification?.status || 'unverified'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500">
                        Your Mock Interview profile is only listed publicly once your identity is verified. Upload a government ID or professional credential for review.
                    </p>
                    {seller?.verification?.status === 'rejected' && seller?.verification?.rejectionReason && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            Rejected: {seller.verification.rejectionReason}
                        </div>
                    )}
                    {['unverified', 'rejected'].includes(seller?.verification?.status || 'unverified') && (
                        <div>
                            <button type="button" onClick={() => verifInputRef.current?.click()} disabled={verifUploading}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                                {verifUploading ? 'Uploading…' : '📎 Upload Document'}
                            </button>
                            <input ref={verifInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleVerificationUpload} />
                        </div>
                    )}
                    {seller?.verification?.status === 'pending' && (
                        <p className="text-sm text-amber-600">Submitted {seller.verification.submittedAt ? new Date(seller.verification.submittedAt).toLocaleDateString() : ''} — awaiting admin review.</p>
                    )}
                </div>

                {/* Editable profile form */}
                <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                    <h2 className="font-bold text-slate-900">Public Profile</h2>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bio</label>
                        <textarea name="bio" value={form.bio} onChange={handleChange} rows={4}
                            placeholder="Tell students about your experience, background, and teaching style..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Areas of Expertise</label>
                        <input type="text" name="expertise" value={form.expertise} onChange={handleChange}
                            placeholder="Python, React, System Design, Machine Learning (comma-separated)"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <p className="text-xs text-slate-400 mt-1">Separate skills with commas</p>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-semibold text-slate-700">Social Links</label>
                        {[
                            { name: 'linkedin', label: '💼 LinkedIn', placeholder: 'https://linkedin.com/in/yourprofile' },
                            { name: 'github', label: '🐙 GitHub', placeholder: 'https://github.com/yourusername' },
                            { name: 'website', label: '🌐 Website', placeholder: 'https://yourwebsite.com' },
                        ].map(f => (
                            <div key={f.name} className="flex items-center gap-3">
                                <span className="w-20 sm:w-24 text-sm text-slate-500 flex-shrink-0">{f.label}</span>
                                <input type="url" name={f.name} value={form.socialLinks[f.name]} onChange={handleSocial}
                                    placeholder={f.placeholder}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={saving}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold disabled:opacity-60 hover:shadow-md transition">
                            {saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </form>

                {/* Account settings link */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex items-center justify-between">
                    <div>
                        <p className="font-semibold text-slate-800">Account Settings</p>
                        <p className="text-sm text-slate-500 mt-0.5">Change your name, password, or personal details</p>
                    </div>
                    <a href="/profile" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition">
                        Go to Profile →
                    </a>
                </div>
            </div>

        </>
    );
}

export default SellerProfile;
