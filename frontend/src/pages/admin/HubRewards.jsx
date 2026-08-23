import { useState, useEffect } from 'react';
import api from '../../lib/api';

const emptyForm = { title: '', description: '', pointsCost: '', type: 'coupon', stock: '', isActive: true, discountType: 'percent', discountValue: '', days: '' };

function AdminHubRewards() {
    const [rewards, setRewards] = useState([]);
    const [redemptions, setRedemptions] = useState([]);
    const [tab, setTab] = useState('catalog');
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [imageFile, setImageFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [r, red] = await Promise.all([api.get('/rewards'), api.get('/rewards/admin/redemptions', { params: { status: 'pending' } })]);
            setRewards(r.data.data || []);
            setRedemptions(red.data.data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { fetchAll(); }, []);

    const openCreate = () => { setForm(emptyForm); setImageFile(null); setError(''); setModal('create'); };
    const openEdit = (r) => {
        setForm({
            title: r.title, description: r.description || '', pointsCost: r.pointsCost, type: r.type,
            stock: r.stock ?? '', isActive: r.isActive,
            discountType: r.metadata?.discountType || 'percent', discountValue: r.metadata?.discountValue || '', days: r.metadata?.days || '',
        });
        setImageFile(null); setError(''); setModal(r);
    };

    const save = async (e) => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            const metadata = form.type === 'coupon' ? { discountType: form.discountType, discountValue: Number(form.discountValue) }
                : form.type === 'subscription_days' ? { days: Number(form.days) } : {};

            const fd = new FormData();
            fd.append('title', form.title);
            fd.append('description', form.description);
            fd.append('pointsCost', form.pointsCost);
            fd.append('type', form.type);
            fd.append('stock', form.stock);
            fd.append('isActive', form.isActive);
            fd.append('metadata', JSON.stringify(metadata));
            if (imageFile) fd.append('logo', imageFile);

            if (modal === 'create') await api.post('/rewards', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            else await api.put(`/rewards/${modal._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

            setModal(null); fetchAll();
        } catch (err) { setError(err.response?.data?.message || 'Failed to save reward'); }
        finally { setSaving(false); }
    };

    const deleteReward = async (id) => {
        if (!window.confirm('Delete this reward?')) return;
        await api.delete(`/rewards/${id}`); fetchAll();
    };

    const processRedemption = async (id, status) => {
        const fulfillmentNote = window.prompt(`Note for this ${status === 'fulfilled' ? 'fulfillment' : 'rejection'} (optional):`) || '';
        try { await api.put(`/rewards/admin/redemptions/${id}`, { status, fulfillmentNote }); fetchAll(); }
        catch (err) { alert(err.response?.data?.message || 'Failed to process redemption'); }
    };

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Interview Hub — Rewards</h1>
                        <p className="text-slate-500">Manage the reward catalog and process redemptions</p>
                    </div>
                    {tab === 'catalog' && <button onClick={openCreate} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-md hover:bg-blue-700">+ Add Reward</button>}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setTab('catalog')} className={`px-3.5 py-2 rounded-full text-xs font-semibold ${tab === 'catalog' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Catalog</button>
                    <button onClick={() => setTab('redemptions')} className={`px-3.5 py-2 rounded-full text-xs font-semibold ${tab === 'redemptions' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Pending Redemptions ({redemptions.length})</button>
                </div>

                {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : tab === 'catalog' ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>{['Title', 'Type', 'Points', 'Stock', 'Redeemed', 'Status', 'Actions'].map(h => <th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rewards.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-400">No rewards yet.</td></tr>
                                    : rewards.map(r => (
                                        <tr key={r._id} className="hover:bg-slate-50">
                                            <td className="px-5 py-4 font-semibold text-slate-800">{r.title}</td>
                                            <td className="px-5 py-4 text-slate-600">{r.type}</td>
                                            <td className="px-5 py-4 text-indigo-600 font-bold">{r.pointsCost}</td>
                                            <td className="px-5 py-4 text-slate-600">{r.stock === null ? '∞' : r.stock}</td>
                                            <td className="px-5 py-4 text-slate-600">{r.redeemedCount}</td>
                                            <td className="px-5 py-4">{r.isActive ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Active</span> : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Inactive</span>}</td>
                                            <td className="px-5 py-4 space-x-3">
                                                <button onClick={() => openEdit(r)} className="text-slate-500 hover:text-slate-800 text-xs font-medium">Edit</button>
                                                <button onClick={() => deleteReward(r._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                        {redemptions.length === 0 ? <div className="p-12 text-center text-slate-400">No pending redemptions.</div> : redemptions.map(r => (
                            <div key={r._id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <p className="font-semibold text-slate-800">{r.reward?.title} <span className="text-xs text-slate-400 font-normal">({r.reward?.type})</span></p>
                                    <p className="text-sm text-slate-500">{r.user?.name} ({r.user?.email}) • {r.pointsSpent} pts • {new Date(r.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => processRedemption(r._id, 'rejected')} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200">Reject (refund points)</button>
                                    <button onClick={() => processRedemption(r._id, 'fulfilled')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">Mark Fulfilled</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-bold text-slate-900">{modal === 'create' ? 'Add Reward' : 'Edit Reward'}</h2>
                            <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>
                        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                        <form onSubmit={save} className="space-y-4">
                            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Reward title" required className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" value={form.pointsCost} onChange={e => setForm(f => ({ ...f, pointsCost: e.target.value }))} placeholder="Points cost" required className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none">
                                    {['coupon', 'subscription_days', 'platform_perk', 'physical_gift', 'digital_perk'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            {form.type === 'coupon' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))} className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none">
                                        <option value="percent">Percent (%)</option><option value="flat">Flat (₹)</option>
                                    </select>
                                    <input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} placeholder="Discount value" className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                                </div>
                            )}
                            {form.type === 'subscription_days' && (
                                <input type="number" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} placeholder="Number of days" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                            )}
                            <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="Stock (leave blank = unlimited)" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full text-sm" />
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} /> Active in catalog
                            </label>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </>
    );
}

export default AdminHubRewards;
