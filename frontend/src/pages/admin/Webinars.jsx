import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ExportButtons from '../../components/ExportButtons';

const STATUS_OPTIONS = ['upcoming', 'live', 'completed', 'cancelled'];

const STATUS_BADGE = {
    upcoming:  'bg-blue-100 text-blue-700 border-blue-200',
    live:      'bg-emerald-100 text-emerald-700 border-emerald-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-red-100 text-red-600 border-red-200',
};

const LIFECYCLE_BADGE = {
    published:        'bg-emerald-100 text-emerald-700',
    pending_approval: 'bg-amber-100 text-amber-700',
    draft:            'bg-slate-100 text-slate-500',
    cancelled:        'bg-red-100 text-red-600',
};

export default function AdminWebinars() {
    const [webinars, setWebinars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selected, setSelected] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [cancelModal, setCancelModal] = useState(null);
    const [cancelReason, setCancelReason] = useState('');

    useEffect(() => { fetchWebinars(); }, []);

    const fetchWebinars = async () => {
        try {
            const res = await api.get('/admin/webinars');
            setWebinars(res.data.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const openEdit = (w) => {
        setSelected(w);
        setEditForm({
            name: w.name,
            description: w.description || '',
            date: w.date ? w.date.slice(0, 10) : '',
            time: w.time || '',
            duration: w.duration,
            numberOfDays: w.numberOfDays,
            seatCapacity: w.seatCapacity,
            price: w.price || 0,
            category: w.category || 'General',
            meetingLink: w.meetingLink || '',
            recordingUrl: w.recordingUrl || '',
            status: w.status,
            isActive: w.isActive,
            isFeatured: w.isFeatured
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.put(`/admin/webinars/${selected._id}`, {
                ...editForm,
                duration: Number(editForm.duration),
                numberOfDays: Number(editForm.numberOfDays),
                seatCapacity: Number(editForm.seatCapacity),
                price: Number(editForm.price)
            });
            setWebinars(prev => prev.map(w => w._id === selected._id
                ? { ...res.data.data, seatsLeft: Math.max(0, res.data.data.seatCapacity - (res.data.data.registeredUsers?.length || 0)), registeredCount: res.data.data.registeredUsers?.length || 0 }
                : w));
            setSelected(null);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update webinar');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id, field, value) => {
        try {
            await api.patch(`/admin/webinars/${id}/toggle`, { field, value });
            setWebinars(prev => prev.map(w => w._id === id ? { ...w, [field]: value } : w));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update');
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/admin/webinars/${id}`);
            setWebinars(prev => prev.filter(w => w._id !== id));
            setDeleteConfirm(null);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete');
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await api.patch(`/admin/webinars/${id}/approve`);
            setWebinars(prev => prev.map(w => w._id === id ? { ...w, lifecycleStatus: res.data.data.lifecycleStatus, roomName: res.data.data.roomName } : w));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to approve');
        }
    };

    const handleReject = async (id) => {
        const reason = prompt('Reason for rejecting this webinar (optional):') || '';
        try {
            await api.patch(`/admin/webinars/${id}/reject`, { reason });
            setWebinars(prev => prev.map(w => w._id === id ? { ...w, lifecycleStatus: 'draft' } : w));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reject');
        }
    };

    const handleAdminCancel = async () => {
        try {
            await api.patch(`/admin/webinars/${cancelModal.id}/cancel`, { reason: cancelReason });
            setWebinars(prev => prev.map(w => w._id === cancelModal.id ? { ...w, status: 'cancelled', isActive: false } : w));
            setCancelModal(null);
            setCancelReason('');
            alert('Webinar cancelled. Refunds issued to all paid registrants.');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to cancel');
        }
    };

    const filtered = webinars.filter(w => {
        const q = search.toLowerCase();
        const matchSearch = w.name?.toLowerCase().includes(q) || w.seller?.name?.toLowerCase().includes(q);
        const matchStatus = filterStatus === 'all' || w.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const stats = [
        {
            label: 'Total Webinars', value: webinars.length,
            cls: 'from-sky-50 to-blue-50 text-sky-700 border-sky-200',
            iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
        },
        {
            label: 'Upcoming', value: webinars.filter(w => w.status === 'upcoming').length,
            cls: 'from-violet-50 to-purple-50 text-violet-700 border-violet-200',
            iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        },
        {
            label: 'Live Now', value: webinars.filter(w => w.status === 'live').length,
            cls: 'from-emerald-50 to-green-50 text-emerald-700 border-emerald-200',
            iconPath: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01',
        },
        {
            label: 'Total Registrations', value: webinars.reduce((a, w) => a + (w.registeredCount || 0), 0),
            cls: 'from-amber-50 to-orange-50 text-amber-700 border-amber-200',
            iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
        },
        {
            label: 'Total Revenue', value: `₹${webinars.reduce((a, w) => a + (w.revenue || 0), 0).toFixed(0)}`,
            cls: 'from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200',
            iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        },
        {
            label: 'On Waitlists', value: webinars.reduce((a, w) => a + (w.waitlistCount || 0), 0),
            cls: 'from-rose-50 to-pink-50 text-rose-700 border-rose-200',
            iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        },
    ];

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    iconBg="from-sky-500 to-indigo-600"
                    title="Webinar Management"
                    subtitle="Monitor, manage, and control all webinars on the platform"
                    actions={
                        <>
                            <Link to="/admin/webinar-analytics"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition">
                                <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Analytics
                            </Link>
                            <ExportButtons
                                data={webinars}
                                filename="Webinars_Report"
                                columns={[
                                    { header: 'Name', key: 'name' },
                                    { header: 'Seller', key: 'seller', format: v => v?.name || '' },
                                    { header: 'Date', key: 'date', format: v => new Date(v).toLocaleDateString() },
                                    { header: 'Time', key: 'time' },
                                    { header: 'Duration (min)', key: 'duration' },
                                    { header: 'Days', key: 'numberOfDays' },
                                    { header: 'Capacity', key: 'seatCapacity' },
                                    { header: 'Registrations', key: 'registeredCount' },
                                    { header: 'Status', key: 'status' },
                                    { header: 'Active', key: 'isActive', format: v => v ? 'Yes' : 'No' },
                                ]}
                            />
                        </>
                    }
                />

                {/* Stats strip */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {stats.map(s => (
                        <div key={s.label} className={`bg-gradient-to-br ${s.cls} rounded-2xl border p-4 flex items-center gap-3`}>
                            <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center flex-shrink-0">
                                <svg className={`w-4.5 h-4.5 ${s.cls.split(' ')[2]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={s.iconPath} />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xl font-black truncate">{s.value}</p>
                                <p className="text-[10px] font-medium opacity-70 leading-tight truncate">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name or seller..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white shadow-sm"
                        />
                    </div>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="all">All Statuses</option>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
                                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Loading webinars...</span>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-16 text-center">
                                <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <p className="text-slate-500 font-medium">No webinars found</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['Webinar', 'Seller', 'Date & Time', 'Duration', 'Days', 'Registrations', 'Waitlist', 'Revenue', 'Status', 'Lifecycle', 'Active', 'Featured', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(w => (
                                        <tr key={w._id} className={`hover:bg-slate-50/70 transition-colors ${!w.isActive ? 'opacity-60' : ''}`}>
                                            <td className="px-4 py-4 max-w-[160px]">
                                                <p className="font-semibold text-slate-900 truncate">{w.name}</p>
                                                <p className="text-xs text-slate-400">{w.category}</p>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-100 to-violet-100 flex items-center justify-center text-primary-700 font-bold text-[10px] flex-shrink-0">
                                                        {w.seller?.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <span className="text-slate-600 text-sm">{w.seller?.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <p className="text-slate-800 font-medium text-sm">{new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                <p className="text-xs text-slate-400">{w.time}</p>
                                            </td>
                                            <td className="px-4 py-4 text-slate-600 whitespace-nowrap text-sm">{w.duration} min</td>
                                            <td className="px-4 py-4 text-slate-600 text-sm">{w.numberOfDays}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(100, ((w.registeredCount || 0) / w.seatCapacity) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs text-slate-600 font-medium">{w.registeredCount || 0}<span className="text-slate-400 font-normal">/{w.seatCapacity}</span></span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {w.waitlistCount > 0
                                                    ? <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{w.waitlistCount}</span>
                                                    : <span className="text-slate-300 text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-emerald-700 whitespace-nowrap text-sm">₹{(w.revenue || 0).toFixed(0)}</td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize border ${STATUS_BADGE[w.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {w.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LIFECYCLE_BADGE[w.lifecycleStatus] || LIFECYCLE_BADGE.published}`}>
                                                    {(w.lifecycleStatus || 'published').replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={() => handleToggle(w._id, 'isActive', !w.isActive)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${w.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${w.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={() => handleToggle(w._id, 'isFeatured', !w.isFeatured)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${w.isFeatured ? 'bg-amber-400' : 'bg-slate-300'}`}>
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${w.isFeatured ? 'translate-x-4' : 'translate-x-1'}`} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {w.lifecycleStatus === 'pending_approval' && (
                                                        <>
                                                            <button onClick={() => handleApprove(w._id)}
                                                                className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold hover:bg-emerald-100 transition whitespace-nowrap">
                                                                Approve
                                                            </button>
                                                            <button onClick={() => handleReject(w._id)}
                                                                className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-100 transition whitespace-nowrap">
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => openEdit(w)}
                                                        className="text-xs px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold hover:bg-primary-100 transition whitespace-nowrap">
                                                        Edit
                                                    </button>
                                                    {w.status !== 'cancelled' && w.status !== 'completed' && (
                                                        <button onClick={() => { setCancelModal({ id: w._id, name: w.name }); setCancelReason(''); }}
                                                            className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold hover:bg-amber-100 transition">
                                                            Cancel
                                                        </button>
                                                    )}
                                                    <button onClick={() => setDeleteConfirm(w._id)}
                                                        className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-100 transition">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Edit Webinar</h2>
                                <p className="text-sm text-slate-500">{selected.name}</p>
                            </div>
                            <button onClick={() => setSelected(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="section-label">Webinar Name</label>
                                <input className="input-field" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                            </div>
                            <div>
                                <label className="section-label">Description</label>
                                <textarea rows={2} className="input-field resize-none" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="section-label">Date</label>
                                    <input type="date" className="input-field" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="section-label">Time</label>
                                    <input type="time" className="input-field" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="section-label">Duration (min)</label>
                                    <input type="number" min={1} className="input-field" value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="section-label">Number of Days</label>
                                    <input type="number" min={1} className="input-field" value={editForm.numberOfDays} onChange={e => setEditForm(f => ({ ...f, numberOfDays: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="section-label">Seat Capacity</label>
                                    <input type="number" min={1} className="input-field" value={editForm.seatCapacity} onChange={e => setEditForm(f => ({ ...f, seatCapacity: e.target.value }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="section-label">Price (₹)</label>
                                    <input type="number" min={0} step={0.01} className="input-field" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="section-label">Status</label>
                                    <select className="input-field" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="section-label">Meeting Link</label>
                                <input type="url" className="input-field" placeholder="https://meet.google.com/..." value={editForm.meetingLink} onChange={e => setEditForm(f => ({ ...f, meetingLink: e.target.value }))} />
                            </div>
                            <div>
                                <label className="section-label">Recording URL <span className="text-slate-400 font-normal">(add after session ends)</span></label>
                                <input type="url" className="input-field" placeholder="https://youtube.com/..." value={editForm.recordingUrl || ''} onChange={e => setEditForm(f => ({ ...f, recordingUrl: e.target.value }))} />
                            </div>
                            <div className="flex items-center gap-6 pt-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                                    <span className="text-sm font-medium text-slate-700">Active (visible to users)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editForm.isFeatured} onChange={e => setEditForm(f => ({ ...f, isFeatured: e.target.checked }))} className="w-4 h-4 accent-amber-500" />
                                    <span className="text-sm font-medium text-slate-700">Featured</span>
                                </label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 disabled:opacity-60 transition-all shadow-primary">
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cancel Modal */}
            {cancelModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Cancel Webinar</h3>
                                <p className="text-sm text-slate-500">"{cancelModal.name}"</p>
                            </div>
                            <button onClick={() => setCancelModal(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm mb-4">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            All paid registrants will be automatically refunded to their wallets.
                        </div>
                        <div className="mb-5">
                            <label className="section-label">Cancellation Reason</label>
                            <textarea rows={3} className="input-field resize-none"
                                placeholder="e.g. Technical issues, host unavailable..."
                                value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setCancelModal(null)} className="btn-secondary flex-1">Back</button>
                            <button onClick={handleAdminCancel}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition">
                                Confirm Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Webinar?</h3>
                        <p className="text-slate-500 text-sm mb-6">This action cannot be undone. All registrations will be lost.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}