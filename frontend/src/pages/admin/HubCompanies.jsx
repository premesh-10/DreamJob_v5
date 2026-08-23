import { useState, useEffect } from 'react';
import api from '../../lib/api';

const emptyForm = { name: '', industry: '', website: '', description: '', aliases: '', isVerified: false };
const emptyResource = { resourceType: 'Course', resourceId: '', title: '', url: '', jobRole: '' };

function AdminHubCompanies() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // 'create' | company object (edit) | null
    const [form, setForm] = useState(emptyForm);
    const [logoFile, setLogoFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [resourceModal, setResourceModal] = useState(null); // company object
    const [resourceForm, setResourceForm] = useState(emptyResource);

    const fetchCompanies = async () => {
        setLoading(true);
        try { const { data } = await api.get('/companies', { params: { sort: 'newest' } }); setCompanies(data.data || []); }
        catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { fetchCompanies(); }, []);

    const openCreate = () => { setForm(emptyForm); setLogoFile(null); setError(''); setModal('create'); };
    const openEdit = (c) => { setForm({ name: c.name, industry: c.industry || '', website: c.website || '', description: c.description || '', aliases: (c.aliases || []).join(', '), isVerified: c.isVerified }); setLogoFile(null); setError(''); setModal(c); };

    const save = async (e) => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            const fd = new FormData();
            fd.append('name', form.name);
            fd.append('industry', form.industry);
            fd.append('website', form.website);
            fd.append('description', form.description);
            form.aliases.split(',').map(a => a.trim()).filter(Boolean).forEach(a => fd.append('aliases[]', a));
            fd.append('isVerified', form.isVerified);
            if (logoFile) fd.append('logo', logoFile);

            if (modal === 'create') await api.post('/companies', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            else await api.put(`/companies/${modal._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

            setModal(null); fetchCompanies();
        } catch (err) { setError(err.response?.data?.message || 'Failed to save company'); }
        finally { setSaving(false); }
    };

    const deleteCompany = async (id) => {
        if (!window.confirm('Delete this company? Only allowed if it has no experiences.')) return;
        try { await api.delete(`/companies/${id}`); fetchCompanies(); }
        catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
    };

    const addResource = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/companies/${resourceModal._id}/resources`, resourceForm);
            setResourceForm(emptyResource);
            const { data } = await api.get(`/companies/${resourceModal.slug}`);
            setResourceModal(data.data);
            fetchCompanies();
        } catch (err) { alert(err.response?.data?.message || 'Failed to add resource'); }
    };

    const removeResource = async (companyId, resourceId) => {
        await api.delete(`/companies/${companyId}/resources/${resourceId}`);
        const updated = companies.find(c => c._id === companyId);
        const { data } = await api.get(`/companies/${updated.slug}`);
        setResourceModal(data.data);
        fetchCompanies();
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Interview Hub — Companies</h1>
                        <p className="text-slate-500">Manage company profiles and link prep resources</p>
                    </div>
                    <button onClick={openCreate} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-md hover:bg-blue-700">+ Add Company</button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>{['Company', 'Experiences', 'Selection Rate', 'Verified', 'Resources', 'Actions'].map(h => <th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {companies.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-slate-400">No companies yet.</td></tr>
                                        : companies.map(c => (
                                            <tr key={c._id} className="hover:bg-slate-50 transition">
                                                <td className="px-5 py-4 font-semibold text-slate-800">{c.name}</td>
                                                <td className="px-5 py-4 text-slate-600">{c.stats?.totalExperiences || 0}</td>
                                                <td className="px-5 py-4 text-slate-600">{c.selectionRate ?? 0}%</td>
                                                <td className="px-5 py-4">{c.isVerified ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Verified</span> : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Unverified</span>}</td>
                                                <td className="px-5 py-4"><button onClick={() => setResourceModal(c)} className="text-blue-600 hover:underline text-xs font-medium">{c.linkedResources?.length || 0} linked — Manage</button></td>
                                                <td className="px-5 py-4 space-x-3">
                                                    <button onClick={() => openEdit(c)} className="text-slate-500 hover:text-slate-800 text-xs font-medium">Edit</button>
                                                    <button onClick={() => deleteCompany(c._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {modal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-bold text-slate-900">{modal === 'create' ? 'Add Company' : 'Edit Company'}</h2>
                            <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>
                        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                        <form onSubmit={save} className="space-y-4">
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" required className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                            <div className="grid grid-cols-2 gap-4">
                                <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="Industry" className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                                <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="Website URL" className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                            </div>
                            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                            <input value={form.aliases} onChange={e => setForm(f => ({ ...f, aliases: e.target.value }))} placeholder="Aliases, comma separated (e.g. Google India, Alphabet)" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none" />
                            <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} className="w-full text-sm" />
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.isVerified} onChange={e => setForm(f => ({ ...f, isVerified: e.target.checked }))} /> Verified profile
                            </label>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {resourceModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-bold text-slate-900">Prep Resources — {resourceModal.name}</h2>
                            <button onClick={() => setResourceModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>

                        <div className="space-y-2 mb-5">
                            {(resourceModal.linkedResources || []).map(r => (
                                <div key={r._id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                                    <div><p className="font-medium text-slate-800">{r.title}</p><p className="text-xs text-slate-400">{r.resourceType}{r.jobRole ? ` • ${r.jobRole}` : ''}</p></div>
                                    <button onClick={() => removeResource(resourceModal._id, r._id)} className="text-red-500 text-xs font-medium">Remove</button>
                                </div>
                            ))}
                            {(!resourceModal.linkedResources || resourceModal.linkedResources.length === 0) && <p className="text-sm text-slate-400">No resources linked yet.</p>}
                        </div>

                        <form onSubmit={addResource} className="space-y-3 border-t border-slate-100 pt-4">
                            <p className="text-sm font-semibold text-slate-700">+ Link a resource</p>
                            <select value={resourceForm.resourceType} onChange={e => setResourceForm(f => ({ ...f, resourceType: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                                {['Course', 'PracticeTest', 'Interview', 'Webinar', 'External'].map(t => <option key={t}>{t}</option>)}
                            </select>
                            <input value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} placeholder="Display title" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                            {resourceForm.resourceType === 'External' ? (
                                <input value={resourceForm.url} onChange={e => setResourceForm(f => ({ ...f, url: e.target.value }))} placeholder="External URL" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                            ) : (
                                <input value={resourceForm.resourceId} onChange={e => setResourceForm(f => ({ ...f, resourceId: e.target.value }))} placeholder="Resource ID (from Courses/Practice Tests/etc.)" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                            )}
                            <input value={resourceForm.jobRole} onChange={e => setResourceForm(f => ({ ...f, jobRole: e.target.value }))} placeholder="Job role scope (optional)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                            <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700">Link Resource</button>
                        </form>
                    </div>
                </div>
            )}

        </>
    );
}

export default AdminHubCompanies;
