import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import {
    createColumnHelper, flexRender,
    getCoreRowModel, useReactTable,
    getPaginationRowModel, getSortedRowModel, getFilteredRowModel
} from '@tanstack/react-table';

const SortAsc = () => (
    <svg className="w-3.5 h-3.5 inline-block ml-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
    </svg>
);
const SortDesc = () => (
    <svg className="w-3.5 h-3.5 inline-block ml-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
    </svg>
);

function AttemptAnalyticsModal({ test, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/admin/practice-tests/${test._id}/attempts`)
            .then(res => setData(res.data.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [test._id]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Attempt Analytics</h2>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{test.title}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : !data ? (
                        <p className="text-center text-slate-500 py-8">Failed to load analytics</p>
                    ) : (
                        <div className="space-y-6">
                            {/* Stats cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Attempts', value: data.analytics.totalAttempts, color: 'bg-violet-50 text-violet-700' },
                                    { label: 'Avg Score', value: `${data.analytics.avgScore}%`, color: 'bg-indigo-50 text-indigo-700' },
                                    { label: 'Pass Rate', value: `${data.analytics.passRate}%`, color: 'bg-emerald-50 text-emerald-700' },
                                    { label: 'Passing Score', value: `${data.test.passingScore}%`, color: 'bg-amber-50 text-amber-700' },
                                ].map(s => (
                                    <div key={s.label} className={`${s.color} rounded-2xl p-4 text-center`}>
                                        <p className="text-2xl font-black">{s.value}</p>
                                        <p className="text-xs font-medium mt-1 opacity-70">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Most missed questions */}
                            {data.analytics.mostMissedQuestions?.length > 0 && (
                                <div>
                                    <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Most Missed Questions
                                    </h3>
                                    <div className="space-y-2">
                                        {data.analytics.mostMissedQuestions.map((q, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center font-bold text-red-700 text-sm flex-shrink-0">
                                                    {q.missRate}%
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{q.questionText}</p>
                                                    <p className="text-xs text-slate-500">{q.missed}/{q.total} students missed</p>
                                                </div>
                                                <div className="w-24 bg-red-200 rounded-full h-2 flex-shrink-0">
                                                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${q.missRate}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent attempts table */}
                            <div>
                                <h3 className="font-bold text-slate-800 mb-3">Recent Attempts</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500">
                                            <tr>
                                                {['Student', 'Score', '%', 'Result', 'Time', 'Date'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left font-semibold text-xs">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {data.attempts.slice(0, 10).map(a => (
                                                <tr key={a._id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-800">{a.user?.name || 'Unknown'}</td>
                                                    <td className="px-4 py-3">{a.score}/{a.totalMarks}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-700">{a.percentage}%</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${a.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                            {a.passed ? 'PASS' : 'FAIL'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">{a.timeTaken ? `${Math.floor(a.timeTaken / 60)}m ${a.timeTaken % 60}s` : '-'}</td>
                                                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {data.attempts.length === 0 && (
                                        <p className="text-center text-slate-400 py-8 text-sm">No attempts yet</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Question Bank moderation tab ────────────────────────────────────────────────
function QuestionModerationTab() {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/question-bank/pending');
            setQuestions(data.data || []);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { fetchPending(); }, []);

    const handleApprove = async (id) => {
        try {
            await api.patch(`/admin/question-bank/${id}/approve`);
            setQuestions(prev => prev.filter(q => q._id !== id));
        } catch { alert('Failed to approve'); }
    };

    const handleReject = async (id) => {
        if (!window.confirm('Permanently delete this question? This cannot be undone.')) return;
        try {
            await api.delete(`/admin/question-bank/${id}`);
            setQuestions(prev => prev.filter(q => q._id !== id));
        } catch (err) { alert(err?.response?.data?.message || 'Failed to delete'); }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800 mb-1">Question Bank — Pending Review</h2>
            <p className="text-sm text-slate-500 mb-4">Newly authored questions referenced by sellers, awaiting approval before counting as moderated content.</p>
            {questions.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">No questions awaiting review.</p>
            ) : (
                <div className="space-y-2">
                    {questions.map(q => (
                        <div key={q._id} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{q.type}</span>
                                    <span className="text-xs text-slate-400">by {q.seller?.name || 'Unknown'}</span>
                                    {q.usageCount > 0 && <span className="text-xs text-amber-600">Used in {q.usageCount} test{q.usageCount !== 1 ? 's' : ''}</span>}
                                </div>
                                <p className="text-sm font-medium text-slate-800">{q.questionText}</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                                <button onClick={() => handleApprove(q._id)} className="text-xs px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100">Approve</button>
                                <button onClick={() => handleReject(q._id)} className="text-xs px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-100">Reject</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Test Series moderation tab ──────────────────────────────────────────────────
function TestSeriesTab() {
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSeries = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/test-series');
            setSeries(data.data || []);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { fetchSeries(); }, []);

    const handleTogglePublish = async (id, current) => {
        if (!window.confirm(`${current ? 'Unpublish' : 'Publish'} this test series?`)) return;
        try {
            const { data } = await api.patch(`/admin/test-series/${id}/publish`);
            setSeries(prev => prev.map(s => s._id === id ? { ...s, isPublished: data.isPublished } : s));
        } catch { alert('Failed'); }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Permanently delete "${title}"?`)) return;
        try {
            await api.delete(`/admin/test-series/${id}`);
            setSeries(prev => prev.filter(s => s._id !== id));
        } catch { alert('Failed to delete'); }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800 mb-1">Test Series</h2>
            <p className="text-sm text-slate-500 mb-4">Bundled multi-test prep packages across all sellers.</p>
            {series.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">No test series created yet.</p>
            ) : (
                <div className="space-y-2">
                    {series.map(s => (
                        <div key={s._id} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {s.isPublished ? 'Published' : 'Draft'}
                                    </span>
                                    <span className="text-xs text-slate-400">by {s.seller?.name || 'Unknown'}</span>
                                    <span className="text-xs text-slate-400">{s.testCount} test{s.testCount !== 1 ? 's' : ''}</span>
                                </div>
                                <p className="text-sm font-medium text-slate-800">{s.title}</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                                <button onClick={() => handleTogglePublish(s._id, s.isPublished)}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border ${s.isPublished ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                                    {s.isPublished ? 'Unpublish' : 'Publish'}
                                </button>
                                <button onClick={() => handleDelete(s._id, s.title)} className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Badge management tab ────────────────────────────────────────────────────────
const BADGE_CRITERIA_TYPES = ['score_threshold', 'attempt_count', 'streak', 'category_mastery'];
const BADGE_CRITERIA_LABELS = {
    score_threshold: 'Score Threshold (% on a single attempt)',
    attempt_count: 'Attempt Count (total completed attempts)',
    streak: 'Streak (consecutive days with an attempt)',
    category_mastery: 'Category Mastery (% in a specific subject/category)'
};

function BadgeModal({ badge, onClose, onSave }) {
    const isEdit = !!badge?._id;
    const [form, setForm] = useState({
        name: badge?.name || '',
        description: badge?.description || '',
        iconUrl: badge?.iconUrl || '',
        criteriaType: badge?.criteria?.type || 'score_threshold',
        value: badge?.criteria?.value ?? 0,
        category: badge?.criteria?.category || ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) return setError('Name is required');

        const payload = {
            name: form.name, description: form.description, iconUrl: form.iconUrl,
            criteria: { type: form.criteriaType, value: Number(form.value) || 0, category: form.category }
        };

        setLoading(true);
        try {
            if (isEdit) await api.put(`/admin/badges/${badge._id}`, payload);
            else await api.post('/admin/badges', payload);
            onSave();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save badge');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-900">{isEdit ? 'Edit Badge' : 'New Badge'}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                        <input name="name" value={form.name} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                        <textarea name="description" value={form.description} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Icon URL <span className="text-slate-400 font-normal">(optional)</span></label>
                        <input name="iconUrl" value={form.iconUrl} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Criteria Type</label>
                            <select name="criteriaType" value={form.criteriaType} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                                {BADGE_CRITERIA_TYPES.map(t => <option key={t} value={t}>{BADGE_CRITERIA_LABELS[t]}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Value <span className="text-slate-400 font-normal">(% or count)</span></label>
                                <input type="number" name="value" value={form.value} onChange={handleChange} min="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                            </div>
                            {form.criteriaType !== 'attempt_count' && form.criteriaType !== 'streak' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Category <span className="text-slate-400 font-normal">(subject, optional)</span></label>
                                    <input name="category" value={form.category} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-60">
                            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Badge'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function BadgesTab() {
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalBadge, setModalBadge] = useState(undefined);

    const fetchBadges = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/badges');
            setBadges(data.data || []);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { fetchBadges(); }, []);

    const handleToggleActive = async (badge) => {
        try {
            await api.put(`/admin/badges/${badge._id}`, { isActive: !badge.isActive });
            fetchBadges();
        } catch { alert('Failed'); }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete badge "${name}"? Already-awarded badges are kept for history.`)) return;
        try { await api.delete(`/admin/badges/${id}`); fetchBadges(); }
        catch { alert('Failed to delete'); }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-bold text-slate-800">Badges</h2>
                    <p className="text-sm text-slate-500">Gamification badges auto-awarded on practice test completion.</p>
                </div>
                <button onClick={() => setModalBadge(null)} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold text-sm">+ New Badge</button>
            </div>
            {badges.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">No badges created yet.</p>
            ) : (
                <div className="space-y-2">
                    {badges.map(b => (
                        <div key={b._id} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                                    <span className="text-xs text-slate-400">{BADGE_CRITERIA_LABELS[b.criteria?.type]}</span>
                                    <span className="text-xs text-slate-400">Awarded {b.timesAwarded} time{b.timesAwarded !== 1 ? 's' : ''}</span>
                                </div>
                                <p className="text-sm font-medium text-slate-800">{b.name}</p>
                                {b.description && <p className="text-xs text-slate-500">{b.description}</p>}
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                                <button onClick={() => setModalBadge(b)} className="text-xs px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100">Edit</button>
                                <button onClick={() => handleToggleActive(b)} className="text-xs px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg font-medium hover:bg-amber-100">{b.isActive ? 'Deactivate' : 'Activate'}</button>
                                <button onClick={() => handleDelete(b._id, b.name)} className="text-xs px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-100">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {modalBadge !== undefined && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(undefined)} onSave={fetchBadges} />}
        </div>
    );
}

function AdminPracticeTests() {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [analyticsTest, setAnalyticsTest] = useState(null);
    const [activeTab, setActiveTab] = useState('tests');

    const fetchTests = async () => {
        try {
            const { data } = await api.get('/admin/practice-tests');
            setTests(data.data || []);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { fetchTests(); }, []);

    const handleTogglePublish = async (testId, current) => {
        if (!window.confirm(`${current ? 'Unpublish' : 'Publish'} this practice test?`)) return;
        try {
            const { data } = await api.patch(`/admin/practice-tests/${testId}/publish`, {});
            setTests(prev => prev.map(t => t._id === testId ? { ...t, isPublished: data.isPublished } : t));
        } catch { alert('Failed'); }
    };

    const handleDelete = async (testId, title) => {
        if (!window.confirm(`Permanently delete "${title}"? All attempt data will be erased.`)) return;
        try {
            await api.delete(`/admin/practice-tests/${testId}`);
            setTests(prev => prev.filter(t => t._id !== testId));
        } catch { alert('Failed to delete'); }
    };

    const columnHelper = createColumnHelper();
    const columns = useMemo(() => [
        columnHelper.accessor('title', {
            header: 'Title',
            cell: info => <div className="font-semibold text-slate-900 max-w-[200px] truncate">{info.getValue()}</div>
        }),
        columnHelper.accessor('subject', {
            header: 'Subject',
            cell: info => <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold">{info.getValue()}</span>
        }),
        columnHelper.accessor('seller.name', {
            header: 'Seller',
            cell: info => info.getValue() || 'Unknown'
        }),
        columnHelper.accessor('assessmentCategory', {
            header: 'Category',
            cell: info => <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{info.getValue() || 'Topic-wise'}</span>
        }),
        columnHelper.accessor('company.name', {
            header: 'Company',
            cell: info => info.getValue() || <span className="text-slate-300">—</span>
        }),
        columnHelper.accessor('questionCount', {
            header: 'Questions',
            cell: info => <span className="font-bold text-slate-700">{info.getValue() || 0}</span>
        }),
        columnHelper.accessor('totalAttempts', {
            header: 'Attempts',
            cell: info => info.getValue() || 0
        }),
        columnHelper.accessor('passRate', {
            header: 'Pass Rate',
            cell: info => (
                <span className={`font-semibold ${info.getValue() >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {info.getValue() || 0}%
                </span>
            )
        }),
        columnHelper.accessor('isPublished', {
            header: 'Status',
            cell: info => (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${info.getValue() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {info.getValue() ? 'Published' : 'Draft'}
                </span>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: props => {
                const test = props.row.original;
                return (
                    <div className="flex gap-2">
                        <button onClick={() => setAnalyticsTest(test)}
                            className="text-xs px-2.5 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg font-medium hover:bg-violet-100">
                            Analytics
                        </button>
                        <button onClick={() => handleTogglePublish(test._id, test.isPublished)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border ${test.isPublished ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                            {test.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button onClick={() => handleDelete(test._id, test.title)}
                            className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100">
                            Delete
                        </button>
                    </div>
                );
            }
        })
    ], []);

    const table = useReactTable({
        data: tests,
        columns,
        state: { globalFilter },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    // Summary stats
    const published = tests.filter(t => t.isPublished).length;
    const totalAttempts = tests.reduce((s, t) => s + (t.totalAttempts || 0), 0);
    const avgPassRate = tests.length ? Math.round(tests.reduce((s, t) => s + (t.passRate || 0), 0) / tests.length) : 0;

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    iconBg="from-violet-500 to-indigo-600"
                    title="Practice Tests"
                    subtitle="Manage all practice tests, question bank, test series and badges"
                />

                {/* Tabs */}
                <div className="flex gap-1 border-b border-slate-200">
                    {[
                        ['tests', 'Practice Tests'],
                        ['questionBank', 'Question Bank'],
                        ['testSeries', 'Test Series'],
                        ['badges', 'Badges']
                    ].map(([key, label]) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {activeTab === 'questionBank' && <QuestionModerationTab />}
                {activeTab === 'testSeries' && <TestSeriesTab />}
                {activeTab === 'badges' && <BadgesTab />}

                {activeTab === 'tests' && (
                <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Tests', value: tests.length, color: 'bg-violet-50 border-violet-200 text-violet-700' },
                        { label: 'Published', value: published, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                        { label: 'Total Attempts', value: totalAttempts, color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                        { label: 'Avg Pass Rate', value: `${avgPassRate}%`, color: 'bg-amber-50 border-amber-200 text-amber-700' },
                    ].map(s => (
                        <div key={s.label} className={`${s.color} rounded-2xl border p-4`}>
                            <p className="text-2xl font-black">{s.value}</p>
                            <p className="text-xs font-medium mt-1 opacity-70">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center gap-4">
                        <div className="relative">
                            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input type="text" value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)}
                                placeholder="Search tests..."
                                className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64 bg-white shadow-sm" />
                        </div>
                        <span className="text-sm text-slate-400">{table.getFilteredRowModel().rows.length} tests</span>
                    </div>

                    {loading ? (
                        <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        {table.getHeaderGroups().map(hg => (
                                            <tr key={hg.id}>
                                                {hg.headers.map(header => (
                                                    <th key={header.id} className="px-5 py-4 cursor-pointer hover:bg-slate-100" onClick={header.column.getToggleSortingHandler()}>
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {{ asc: <SortAsc />, desc: <SortDesc /> }[header.column.getIsSorted()] ?? null}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {table.getRowModel().rows.map(row => (
                                            <tr key={row.id} className="hover:bg-slate-50 transition">
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-5 py-4">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {table.getRowModel().rows.length === 0 && (
                                    <div className="p-10 text-center text-slate-400">No practice tests found.</div>
                                )}
                            </div>
                            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                                <span className="text-sm text-slate-500">Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
                                <div className="space-x-2">
                                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 disabled:opacity-40 text-xs font-medium hover:bg-slate-100 transition">Prev</button>
                                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 disabled:opacity-40 text-xs font-medium hover:bg-slate-100 transition">Next</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                </>
                )}
            </div>

            {analyticsTest && <AttemptAnalyticsModal test={analyticsTest} onClose={() => setAnalyticsTest(null)} />}

        </>
    );
}

export default AdminPracticeTests;
