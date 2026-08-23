import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '../features/auth/authSlice';
import api from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

function getAvatarUrl(pic) {
    if (!pic) return null;
    if (pic.startsWith('http')) return pic;
    return `${API_BASE}${pic}`;
}

function Profile() {
    const { user } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: '', mobile: '', experience: '', gender: '', qualification: '', country: '',
    });
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [avatarPreview, setAvatarPreview] = useState(null);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                mobile: user.mobile || '',
                experience: user.experience || '',
                gender: user.gender || '',
                qualification: user.qualification || '',
                country: user.country || '',
            });
            setAvatarPreview(getAvatarUrl(user.profilePic));
        }
    }, [user]);

    const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMsg(''); setErrorMsg('');
        try {
            const { data } = await api.put('/users/profile', formData);
            dispatch(setUser(data.data));
            setIsEditing(false);
            setSuccessMsg('Profile updated successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            setErrorMsg('Failed to update: ' + (error.response?.data?.message || error.message));
        }
        setLoading(false);
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Preview immediately
        const objectUrl = URL.createObjectURL(file);
        setAvatarPreview(objectUrl);

        setAvatarLoading(true);
        setSuccessMsg(''); setErrorMsg('');
        try {
            const formPayload = new FormData();
            formPayload.append('avatar', file);
            const { data } = await api.post('/users/profile/avatar', formPayload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            dispatch(setUser(data.data));
            setAvatarPreview(getAvatarUrl(data.data.profilePic));
            setSuccessMsg('Profile picture updated!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            setAvatarPreview(getAvatarUrl(user?.profilePic));
            setErrorMsg('Failed to upload image: ' + (error.response?.data?.message || error.message));
        }
        setAvatarLoading(false);
    };

    const handleRemoveAvatar = async () => {
        if (!window.confirm('Remove profile picture?')) return;
        setAvatarLoading(true);
        try {
            await api.delete('/users/profile/avatar');
            setAvatarPreview(null);
            dispatch(setUser({ ...user, profilePic: '' }));
            setSuccessMsg('Profile picture removed.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            setErrorMsg('Failed to remove picture.');
        }
        setAvatarLoading(false);
    };

    const initials = user?.name?.charAt(0)?.toUpperCase() || '?';

    return (
        <>
            <div className="max-w-4xl mx-auto py-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-8">
                    <div>
                        <h1 className="page-title">My Profile</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Manage your personal information</p>
                    </div>
                    <button
                        onClick={() => { setIsEditing(!isEditing); setErrorMsg(''); }}
                        className={isEditing ? 'btn-secondary text-sm py-2' : 'btn-primary text-sm py-2'}
                    >
                        {isEditing ? 'Cancel' : 'Edit Profile'}
                    </button>
                </div>

                {successMsg && (
                    <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl font-medium flex items-center gap-2">
                        <span>✓</span> {successMsg}
                    </div>
                )}
                {errorMsg && (
                    <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-medium flex items-center gap-2">
                        <span>⚠</span> {errorMsg}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Avatar Section */}
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 sm:px-8 py-6 sm:py-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <div className="relative flex-shrink-0">
                            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/40 overflow-hidden flex items-center justify-center text-white text-3xl font-black shadow-lg">
                                {avatarLoading ? (
                                    <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                ) : avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" onError={() => setAvatarPreview(null)} />
                                ) : (
                                    initials
                                )}
                            </div>
                            {/* Upload overlay button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={avatarLoading}
                                className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-violet-50 transition border-2 border-violet-200"
                                title="Change photo"
                            >
                                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>
                        <div className="text-white text-center sm:text-left">
                            <h2 className="text-xl font-black">{user?.name}</h2>
                            <p className="text-white/70 text-sm">{user?.email}</p>
                            <p className="text-white/60 text-xs mt-1 capitalize">{user?.role}</p>
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={avatarLoading}
                                    className="text-xs bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full transition font-medium"
                                >
                                    {avatarPreview ? '📷 Change Photo' : '📷 Upload Photo'}
                                </button>
                                {avatarPreview && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveAvatar}
                                        disabled={avatarLoading}
                                        className="text-xs bg-white/10 hover:bg-red-500/40 text-white/80 px-4 py-2 rounded-full transition font-medium"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form Section */}
                    <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                                <input type="text" name="name" value={formData.name} onChange={onChange} disabled={!isEditing}
                                    className="input-field text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email <span className="font-normal text-slate-400">(read-only)</span></label>
                                <input type="email" value={user?.email || ''} disabled
                                    className="input-field text-sm bg-slate-50 text-slate-400 cursor-default" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile</label>
                                <input type="text" name="mobile" value={formData.mobile} onChange={onChange} disabled={!isEditing}
                                    className="input-field text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                                <select name="gender" value={formData.gender} onChange={onChange} disabled={!isEditing}
                                    className="input-field text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default">
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Experience</label>
                                <input type="text" name="experience" value={formData.experience} onChange={onChange} disabled={!isEditing}
                                    placeholder="e.g. 3 years"
                                    className="input-field text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Country</label>
                                <input type="text" name="country" value={formData.country} onChange={onChange} disabled={!isEditing}
                                    className="input-field text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Qualification</label>
                                <input type="text" name="qualification" value={formData.qualification} onChange={onChange} disabled={!isEditing}
                                    placeholder="e.g. B.Tech Computer Science"
                                    className="input-field text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default" />
                            </div>
                        </div>

                        {/* Subscription Info */}
                        <div className="pt-5 border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Current Plan</p>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                                    !user?.subscription?.plan || user?.subscription?.plan === 'None'
                                        ? 'bg-slate-100 text-slate-600'
                                        : user?.subscription?.plan === 'Ruby'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-primary-100 text-primary-700'
                                }`}>
                                    {user?.subscription?.plan && user.subscription.plan !== 'None' ? user.subscription.plan : 'Free'}
                                </span>
                                {user?.subscription?.plan && user.subscription.plan !== 'None' && user?.subscription?.validUntil && (
                                    <span className="text-sm text-slate-500">
                                        Valid until {new Date(user.subscription.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>

                        {isEditing && (
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => { setIsEditing(false); setErrorMsg(''); }} className="btn-secondary text-sm py-2">
                                    Cancel
                                </button>
                                <button type="submit" disabled={loading}
                                    className="btn-primary text-sm py-2 disabled:opacity-60">
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving…
                                        </span>
                                    ) : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>

        </>
    );
}

export default Profile;
