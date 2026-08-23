import { useState, useEffect } from 'react';
import api from '../../lib/api';

const emptyForm = { code: '', discountType: 'percent', discountValue: '', minOrderAmount: '', maxUses: '100', expiresAt: '', applicableTo: 'all' };

function AdminCoupons() {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchCoupons = async () => {
        setLoading(true);
        api.get('/admin/coupons').then(r => setCoupons(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
    };
    useEffect(() => { fetchCoupons(); }, []);

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value.toUpperCase ? (e.target.name === 'code' ? e.target.value.toUpperCase() : e.target.value) : e.target.value }));

    const createCoupon = async e => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            await api.post('/admin/coupons', { ...form, discountValue: +form.discountValue, minOrderAmount: +form.minOrderAmount, maxUses: +form.maxUses });
            setShowModal(false); setForm(emptyForm); fetchCoupons();
        } catch (err) { setError(err?.response?.data?.message || 'Failed to create coupon'); }
        finally { setSaving(false); }
    };

    const toggleCoupon = async (id) => {
        try { await api.patch(`/admin/coupons/${id}/toggle`); fetchCoupons(); }
        catch { alert('Failed to toggle coupon'); }
    };

    const deleteCoupon = async (id) => {
        if (!window.confirm('Delete this coupon?')) return;
        try { await api.delete(`/admin/coupons/${id}`); fetchCoupons(); }
        catch { alert('Failed to delete coupon'); }
    };

    const isExpired = (date) => new Date(date) < new Date();

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Coupons</h1>
                        <p className="text-slate-500">Create and manage discount codes</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-md hover:bg-blue-700">+ Create Coupon</button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>{['Code','Type','Discount','Max Uses','Used','Expires','Scope','Status','Actions'].map(h=><th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {coupons.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">No coupons yet. Create your first one!</td></tr>
                                    : coupons.map(c => (
                                        <tr key={c._id} className={`hover:bg-slate-50 transition ${!c.isActive || isExpired(c.expiresAt) ? 'opacity-60' : ''}`}>
                                            <td className="px-5 py-4 font-mono font-bold text-slate-800 tracking-widest">{c.code}</td>
                                            <td className="px-5 py-4 text-slate-600 capitalize">{c.discountType}</td>
                                            <td className="px-5 py-4 font-semibold text-emerald-600">{c.discountType === 'percent' ? `${c.discountValue}%` : `₹${c.discountValue}`}</td>
                                            <td className="px-5 py-4 text-slate-600">{c.maxUses}</td>
                                            <td className="px-5 py-4 text-slate-600">{c.usedCount}</td>
                                            <td className="px-5 py-4 text-slate-500 text-xs">{new Date(c.expiresAt).toLocaleDateString()}{isExpired(c.expiresAt) && <span className="ml-1 text-red-500">(expired)</span>}</td>
                                            <td className="px-5 py-4 capitalize text-slate-600">{c.applicableTo}</td>
                                            <td className="px-5 py-4">
                                                <button onClick={() => toggleCoupon(c._id)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${c.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                    {c.isActive ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4">
                                                <button onClick={() => deleteCoupon(c._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-bold text-slate-900">Create Coupon</h2>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>
                        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                        <form onSubmit={createCoupon} className="grid grid-cols-2 gap-4">
                            {[
                                { name:'code', label:'Coupon Code', type:'text', placeholder:'SAVE20', span:2 },
                                { name:'discountValue', label:'Discount Value', type:'number', placeholder:'20' },
                                { name:'minOrderAmount', label:'Min Order ($)', type:'number', placeholder:'0' },
                                { name:'maxUses', label:'Max Uses', type:'number', placeholder:'100' },
                                { name:'expiresAt', label:'Expires At', type:'date', span:1 },
                            ].map(f => (
                                <div key={f.name} className={f.span === 2 ? 'col-span-2' : ''}>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{f.label}</label>
                                    <input type={f.type} name={f.name} value={form[f.name]} onChange={handleChange} required placeholder={f.placeholder}
                                        min={f.type === 'date' ? new Date().toISOString().split('T')[0] : undefined}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            ))}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Discount Type</label>
                                <select name="discountType" value={form.discountType} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="percent">Percent (%)</option>
                                    <option value="flat">Flat ($)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Applicable To</label>
                                <select name="applicableTo" value={form.applicableTo} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                                    {['all','courses','interviews','subscriptions'].map(v=><option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-60">{saving?'Creating...':'Create Coupon'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </>
    );
}
export default AdminCoupons;
