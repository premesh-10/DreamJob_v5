import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { ASSESSMENT_CATEGORIES } from './PracticeTests';

// ── Create / Edit metadata modal ───────────────────────────────────────────────
function SeriesModal({ series, onClose, onSave, companies }) {
    const isEdit = !!series?._id;
    const [form, setForm] = useState({
        title: series?.title || '',
        description: series?.description || '',
        subject: series?.subject || '',
        tags: (series?.tags || []).join(', '),
        assessmentCategory: series?.assessmentCategory || 'Topic-wise',
        companyId: series?.company?._id || series?.company || '',
        targetRole: series?.targetRole || '',
        isFree: series?.pricing?.isFree ?? true,
        price: series?.pricing?.price ?? 0,
        availableFrom: series?.schedule?.availableFrom ? series.schedule.availableFrom.slice(0, 10) : '',
        availableUntil: series?.schedule?.availableUntil ? series.schedule.availableUntil.slice(0, 10) : '',
        certificateEnabled: series?.certificate?.enabled ?? false
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.title.trim()) return setError('Title is required');

        const payload = {
            title: form.title,
            description: form.description,
            subject: form.subject,
            tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
            assessmentCategory: form.assessmentCategory,
            company: form.companyId || null,
            targetRole: form.targetRole,
            pricing: { isFree: form.isFree, price: form.isFree ? 0 : Number(form.price) || 0 },
            schedule: { availableFrom: form.availableFrom || null, availableUntil: form.availableUntil || null },
            certificate: { enabled: form.certificateEnabled }
        };

        setLoading(true);
        try {
            if (isEdit) {
                const { data } = await api.put(`/test-series/${series._id}`, payload);
                onSave(data.data);
            } else {
                const { data } = await api.post('/test-series', payload);
                onSave(data.data);
            }
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save test series');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-900">{isEdit ? '✏️ Edit Test Series' : '🆕 New Test Series'}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>
                {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title *</label>
                        <input name="title" value={form.title} onChange={handleChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                            placeholder="e.g. 30-Day SDE Interview Prep" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                        <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-sm resize-none" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
                            <input name="subject" value={form.subject} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tags <span className="text-slate-400 font-normal">(comma-separated)</span></label>
                            <input name="tags" value={form.tags} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                        </div>
                    </div>

                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                            <select name="assessmentCategory" value={form.assessmentCategory} onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                                {ASSESSMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Company <span className="text-slate-400 font-normal">(optional)</span></label>
                            <select name="companyId" value={form.companyId} onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                                <option value="">None</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Target Role</label>
                            <input name="targetRole" value={form.targetRole} onChange={handleChange} placeholder="e.g. SDE-1"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 space-y-4">
                        <h3 className="font-semibold text-amber-900 text-sm">💰 Pricing &amp; Schedule</h3>
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="seriesFree" name="isFree" checked={form.isFree} onChange={handleChange} className="w-4 h-4 accent-amber-600" />
                            <label htmlFor="seriesFree" className="text-sm font-medium text-slate-700">Free for all students</label>
                        </div>
                        {!form.isFree && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Price (₹)</label>
                                <input type="number" name="price" value={form.price} onChange={handleChange} min="0"
                                    className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm" />
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Available From</label>
                                <input type="date" name="availableFrom" value={form.availableFrom} onChange={handleChange}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Available Until</label>
                                <input type="date" name="availableUntil" value={form.availableUntil} onChange={handleChange}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="certEnabled" name="certificateEnabled" checked={form.certificateEnabled} onChange={handleChange} className="w-4 h-4 accent-violet-600" />
                        <label htmlFor="certEnabled" className="text-sm font-medium text-slate-700">Award a certificate on completing every test in this series</label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-60">
                            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Series'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Manage tests within a series ───────────────────────────────────────────────
function SeriesDrawer({ series: initialSeries, myTests, onClose, onUpdate }) {
    const [series, setSeries] = useState(initialSeries);
    const [addingTestId, setAddingTestId] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState('');

    const includedIds = new Set(series.tests.map(t => (t.practiceTest?._id || t.practiceTest)));
    const availableTests = myTests.filter(t => !includedIds.has(t._id));

    const refresh = async () => {
        const { data } = await api.get(`/test-series/${series._id}`);
        setSeries(data.data);
        onUpdate();
    };

    const handleAdd = async () => {
        if (!addingTestId) return;
        setError('');
        try {
            await api.post(`/test-series/${series._id}/tests`, { practiceTestId: addingTestId });
            setAddingTestId('');
            refresh();
        } catch (err) { setError(err?.response?.data?.message || 'Failed to add test'); }
    };

    const handleRemove = async (refId) => {
        if (!window.confirm('Remove this test from the series?')) return;
        await api.delete(`/test-series/${series._id}/tests/${refId}`);
        refresh();
    };

    const handleMove = async (idx, dir) => {
        const ordered = [...series.tests].sort((a, b) => a.order - b.order);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= ordered.length) return;
        [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
        await api.put(`/test-series/${series._id}/tests/reorder`, { orderedRefIds: ordered.map(t => t._id) });
        refresh();
    };

    const handlePublishToggle = async () => {
        setPublishing(true);
        try {
            const { data } = await api.patch(`/test-series/${series._id}/publish`, {});
            setSeries(p => ({ ...p, isPublished: data.isPublished }));
            onUpdate();
        } catch (err) { alert(err?.response?.data?.message || 'Failed'); }
        finally { setPublishing(false); }
    };

    const orderedTests = [...series.tests].sort((a, b) => a.order - b.order);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end">
            <div className="bg-white h-full w-full max-w-xl shadow-2xl overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{series.title}</h2>
                        <p className="text-sm text-slate-500">{orderedTests.length} test{orderedTests.length !== 1 ? 's' : ''} in this series</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    <button onClick={handlePublishToggle} disabled={publishing}
                        className={`w-full py-3 rounded-xl font-semibold disabled:opacity-60 ${series.isPublished ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                        {publishing ? 'Updating...' : series.isPublished ? '⏸ Unpublish Series' : '🚀 Publish Series'}
                    </button>

                    {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-2">Add a Test</h3>
                        <div className="flex gap-2">
                            <select value={addingTestId} onChange={e => setAddingTestId(e.target.value)}
                                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-violet-500">
                                <option value="">Select a practice test...</option>
                                {availableTests.map(t => <option key={t._id} value={t._id}>{t.title}{!t.isPublished ? ' (draft)' : ''}</option>)}
                            </select>
                            <button onClick={handleAdd} disabled={!addingTestId}
                                className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-violet-700">
                                Add
                            </button>
                        </div>
                        {availableTests.length === 0 && <p className="text-xs text-slate-400 mt-1.5">All of your practice tests are already in this series.</p>}
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-2">Tests in Order</h3>
                        {orderedTests.length === 0 ? (
                            <p className="text-sm text-slate-400 italic py-6 text-center">No tests added yet. A series needs at least one test before it can be published.</p>
                        ) : (
                            <div className="space-y-2">
                                {orderedTests.map((t, idx) => (
                                    <div key={t._id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                                        <span className="w-7 h-7 flex-shrink-0 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{t.practiceTest?.title || 'Test removed'}</p>
                                            {t.practiceTest && !t.practiceTest.isPublished && <span className="text-xs text-amber-600">Draft — publish this test for students to take it</span>}
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-100">↑</button>
                                            <button onClick={() => handleMove(idx, 1)} disabled={idx === orderedTests.length - 1} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-100">↓</button>
                                            <button onClick={() => handleRemove(t._id)} className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100">×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function SellerTestSeries() {
    const [seriesList, setSeriesList] = useState([]);
    const [myTests, setMyTests] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalSeries, setModalSeries] = useState(undefined);
    const [drawerSeries, setDrawerSeries] = useState(null);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [seriesRes, testsRes, companiesRes] = await Promise.all([
                api.get('/test-series/mine'),
                api.get('/practice-tests/mine'),
                api.get('/companies')
            ]);
            setSeriesList(seriesRes.data.data || []);
            setMyTests(testsRes.data.data || []);
            setCompanies(companiesRes.data.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this test series? The underlying practice tests will not be affected.')) return;
        try { await api.delete(`/test-series/${id}`); fetchAll(); }
        catch { alert('Failed to delete'); }
    };

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Test Series</h1>
                        <p className="text-slate-500 mt-1">Bundle your practice tests into ordered prep packages</p>
                    </div>
                    <button onClick={() => setModalSeries(null)}
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition">
                        + New Series
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : seriesList.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-6xl">📦</span>
                        <p className="text-slate-600 font-semibold mt-4 text-lg">No test series yet</p>
                        <p className="text-slate-400 text-sm mt-1">Bundle multiple practice tests into one purchasable prep package.</p>
                        <button onClick={() => setModalSeries(null)} className="mt-4 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">
                            Create First Series
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {seriesList.map(s => (
                            <div key={s._id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <h3 className="font-bold text-slate-900">{s.title}</h3>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {s.isPublished ? 'Published' : 'Draft'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{s.description || 'No description'}</p>
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{s.assessmentCategory}</span>
                                    <span className="text-xs text-slate-400">{s.testCount} test{s.testCount !== 1 ? 's' : ''}</span>
                                    <span className="text-xs text-slate-400">{s.pricing?.isFree ? 'Free' : `₹${s.pricing?.price}`}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setDrawerSeries(s)} className="flex-1 text-xs px-3 py-2 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg font-semibold hover:bg-violet-100">
                                        Manage Tests
                                    </button>
                                    <button onClick={() => setModalSeries(s)} className="text-xs px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100">Edit</button>
                                    <button onClick={() => handleDelete(s._id)} className="text-xs px-3 py-2 bg-red-50 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-100">Del</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalSeries !== undefined && (
                <SeriesModal series={modalSeries} companies={companies} onClose={() => setModalSeries(undefined)} onSave={fetchAll} />
            )}
            {drawerSeries && (
                <SeriesDrawer series={drawerSeries} myTests={myTests} onClose={() => setDrawerSeries(null)} onUpdate={fetchAll} />
            )}

        </>
    );
}

export default SellerTestSeries;
