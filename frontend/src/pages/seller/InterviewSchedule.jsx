import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

function InterviewSchedule() {
    const [profile, setProfile] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileForm, setProfileForm] = useState({ domain: '', price: '' });
    const [slotForm, setSlotForm] = useState({ date: '', startTime: '', endTime: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [addingSlot, setAddingSlot] = useState(false);
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [joinSettings, setJoinSettings] = useState({ interviewJoinWindowMinutesBefore: 15, interviewJoinWindowMinutesAfterEnd: 0 });
    const navigate = useNavigate();

    const load = async () => {
        setLoading(true);
        try {
            const [p, b] = await Promise.all([
                api.get('/interviews/mine'),
                api.get('/interviews/bookings/seller')
            ]);
            const prof = p.data.data;
            setProfile(prof);
            if (prof) setProfileForm({ domain: prof.domain, price: prof.price });
            setBookings(b.data.data?.filter(b => b.type === 'interview') || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        api.get('/settings/public').then(r => r.data?.data && setJoinSettings(r.data.data)).catch(() => {});
    }, []);

    const isJoinEnabled = (session) => {
        if (!session) return false;
        const now = new Date();
        const windowStart = new Date(new Date(session.scheduledStart).getTime() - joinSettings.interviewJoinWindowMinutesBefore * 60000);
        const windowEnd = new Date(new Date(session.scheduledEnd).getTime() + (joinSettings.interviewJoinWindowMinutesAfterEnd || 0) * 60000);
        return now >= windowStart && now <= windowEnd;
    };

    const saveProfile = async e => {
        e.preventDefault(); setSavingProfile(true); setMsg(''); setError('');
        try {
            await api.post('/interviews', profileForm);
            setMsg('Interview profile saved!');
            load();
        } catch (err) { setError(err?.response?.data?.message || 'Failed to save profile'); }
        finally { setSavingProfile(false); }
    };

    const addSlot = async e => {
        e.preventDefault(); setAddingSlot(true); setError('');
        try {
            const startTime = new Date(`${slotForm.date}T${slotForm.startTime}`).toISOString();
            const endTime = new Date(`${slotForm.date}T${slotForm.endTime}`).toISOString();
            await api.post('/interviews/slots', { startTime, endTime });
            setShowSlotModal(false);
            setSlotForm({ date: '', startTime: '', endTime: '' });
            setMsg('Slot added!');
            load();
        } catch (err) { setError(err?.response?.data?.message || 'Failed to add slot'); }
        finally { setAddingSlot(false); }
    };

    const deleteSlot = async (slotId) => {
        if (!window.confirm('Remove this slot?')) return;
        try { await api.delete(`/interviews/slots/${slotId}`); load(); }
        catch (err) { alert('Failed to delete slot'); }
    };

    const cancelBooking = async (session) => {
        if (!window.confirm('Cancel this interview? The candidate will be notified and refunded per the cancellation policy.')) return;
        try { await api.patch(`/interview-sessions/${session._id}/cancel`, { reason: 'Cancelled by interviewer' }); load(); }
        catch (err) { alert(err?.response?.data?.message || 'Failed to cancel'); }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Interview Schedule</h1>
                    <p className="text-slate-500 mt-1">Manage your interview profile, time slots, and bookings</p>
                </div>

                {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{msg}</div>}
                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

                {/* Interview Profile */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">🎙️ Interview Profile</h2>
                    <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Domain / Expertise *</label>
                            <input type="text" value={profileForm.domain} onChange={e => setProfileForm(p=>({...p,domain:e.target.value}))} required
                                placeholder="e.g. System Design, React, Python"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Price per Session ($) *</label>
                            <input type="number" value={profileForm.price} onChange={e => setProfileForm(p=>({...p,price:e.target.value}))} required min="0"
                                placeholder="0"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-2 text-xs text-slate-500 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                            <span>🎥</span>
                            <span>Interviews are conducted over a secure, auto-generated video room (powered by LiveKit) — created automatically the moment a candidate books a slot.</span>
                        </div>
                        <div className="md:col-span-2">
                            <button type="submit" disabled={savingProfile}
                                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold disabled:opacity-60 hover:shadow-md transition">
                                {savingProfile ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Time Slots */}
                {profile && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900">🗓️ Available Slots</h2>
                            <button onClick={() => setShowSlotModal(true)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
                                + Add Slot
                            </button>
                        </div>

                        {profile.slots?.length > 0 ? (
                            <div className="space-y-3">
                                {profile.slots.map(slot => (
                                    <div key={slot._id} className={`flex items-center justify-between flex-wrap gap-2 p-4 rounded-xl border ${slot.isBooked ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-indigo-50 border-indigo-200'}`}>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">
                                                {new Date(slot.startTime).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} &nbsp;
                                                {new Date(slot.startTime).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} – {new Date(slot.endTime).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                                            </p>
                                            <span className="text-xs text-indigo-600">🎥 LiveKit video room (auto-created on booking)</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${slot.isBooked ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {slot.isBooked ? 'Booked' : 'Available'}
                                            </span>
                                            {!slot.isBooked && (
                                                <button onClick={() => deleteSlot(slot._id)} className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition">Remove</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-slate-400">
                                <span className="text-4xl">🗓️</span>
                                <p className="mt-2 text-sm">No slots yet. Add your first available slot!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Upcoming Bookings */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Upcoming Bookings</h2>
                    {bookings.length > 0 ? (
                        <>
                        {/* Mobile card view */}
                        <div className="sm:hidden divide-y divide-slate-100 -mx-6 px-0">
                            {bookings.map(b => (
                                <div key={b._id} className="px-6 py-4 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm truncate">{b.user?.name}</p>
                                            <p className="text-xs text-slate-400">{new Date(b.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <span className="font-bold text-emerald-600 text-sm flex-shrink-0">${b.amountPaid?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded-full">{b.session?.completionStatus?.replace('_', ' ') || '—'}</span>
                                        {b.session?.completionStatus === 'awaiting_feedback' ? (
                                            <button onClick={() => navigate(`/interview-room/${b.session._id}/feedback`)} className="text-amber-600 text-xs font-medium px-2 py-1 bg-amber-50 rounded-lg">✍️ Leave Feedback</button>
                                        ) : b.session ? (
                                            isJoinEnabled(b.session) ? (
                                                <button onClick={() => navigate(`/interview-room/${b.session._id}`)} className="text-emerald-600 text-xs font-medium px-2 py-1 bg-emerald-50 rounded-lg">🎥 Join →</button>
                                            ) : (
                                                <span className="text-indigo-600 text-xs font-medium">🎥 Ready</span>
                                            )
                                        ) : <span className="text-slate-400 text-xs">Pending</span>}
                                        {b.session && ['not_started', 'in_progress', 'awaiting_feedback'].includes(b.session.completionStatus) && new Date() < new Date(b.session.scheduledStart) && (
                                            <button onClick={() => cancelBooking(b.session)} className="text-red-500 text-xs font-medium px-2 py-1 bg-red-50 rounded-lg">Cancel</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-slate-500 border-b border-slate-100">{['Student','Date','Time','Amount','Video Room','Status',''].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}</tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                    {bookings.map(b => (
                                        <tr key={b._id} className="hover:bg-slate-50">
                                            <td className="py-3 pr-4 font-medium text-slate-800">{b.user?.name}</td>
                                            <td className="py-3 pr-4 text-slate-600">{new Date(b.createdAt).toLocaleDateString()}</td>
                                            <td className="py-3 pr-4 text-slate-600">Confirmed</td>
                                            <td className="py-3 pr-4 font-semibold text-emerald-600">${b.amountPaid?.toFixed(2)}</td>
                                            <td className="py-3 pr-4">
                                                {b.session?.completionStatus === 'awaiting_feedback' ? (
                                                    <button onClick={() => navigate(`/interview-room/${b.session._id}/feedback`)} className="text-amber-600 text-xs hover:underline font-medium">✍️ Leave Feedback</button>
                                                ) : b.session ? (
                                                    isJoinEnabled(b.session) ? (
                                                        <button onClick={() => navigate(`/interview-room/${b.session._id}`)} className="text-emerald-600 text-xs hover:underline font-medium">🎥 Join →</button>
                                                    ) : (
                                                        <span className="text-indigo-600 text-xs font-medium">🎥 Ready</span>
                                                    )
                                                ) : <span className="text-slate-400 text-xs">Pending</span>}
                                            </td>
                                            <td className="py-3 pr-4 text-xs text-slate-500 capitalize">{b.session?.completionStatus?.replace('_', ' ') || '—'}</td>
                                            <td className="py-3 pr-4">
                                                {b.session && ['not_started', 'in_progress', 'awaiting_feedback'].includes(b.session.completionStatus) && new Date() < new Date(b.session.scheduledStart) && (
                                                    <button onClick={() => cancelBooking(b.session)} className="text-red-500 hover:underline text-xs font-medium">Cancel</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>{/* end hidden sm:block */}
                        </>
                    ) : <p className="text-slate-400 text-sm text-center py-8">No bookings yet</p>}
                </div>
            </div>

            {/* Add Slot Modal */}
            {showSlotModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-slate-900">Add New Slot</h3>
                            <button onClick={() => setShowSlotModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>
                        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                        <form onSubmit={addSlot} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date *</label>
                                <input type="date" value={slotForm.date} onChange={e=>setSlotForm(p=>({...p,date:e.target.value}))} required
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Time *</label>
                                    <input type="time" value={slotForm.startTime} onChange={e=>setSlotForm(p=>({...p,startTime:e.target.value}))} required
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">End Time *</label>
                                    <input type="time" value={slotForm.endTime} onChange={e=>setSlotForm(p=>({...p,endTime:e.target.value}))} required
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">🎥 A secure video room is created automatically once a candidate books this slot — no link needed.</p>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowSlotModal(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-semibold text-slate-700">Cancel</button>
                                <button type="submit" disabled={addingSlot} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold disabled:opacity-60">
                                    {addingSlot ? 'Adding...' : 'Add Slot'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </>
    );
}

export default InterviewSchedule;
