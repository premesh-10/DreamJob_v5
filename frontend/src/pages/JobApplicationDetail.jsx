import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../lib/api';

const STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Offer Received', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted'];
const STAGE_NAMES = ['Online Assessment', 'Technical Round 1', 'Technical Round 2', 'Machine Coding', 'System Design', 'Behavioral Round', 'HR Round', 'Final Round', 'Custom'];
const MODES = ['Phone', 'Video Call', 'Onsite', 'Online Assessment Platform'];
const STAGE_STATUSES = ['Pending', 'Cleared', 'Rejected', 'Rescheduled'];

const FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

const statusColor = (status) => {
    const map = {
        Applied: 'bg-slate-100 text-slate-700', Shortlisted: 'bg-blue-100 text-blue-700',
        Interviewing: 'bg-amber-100 text-amber-700', 'Offer Received': 'bg-purple-100 text-purple-700',
        Accepted: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700',
        Withdrawn: 'bg-slate-200 text-slate-600', Ghosted: 'bg-orange-100 text-orange-700'
    };
    return map[status] || 'bg-gray-100 text-gray-700';
};

const stageStatusColor = (status) => {
    const map = {
        Pending: 'bg-slate-100 text-slate-700', Cleared: 'bg-emerald-100 text-emerald-700',
        Rejected: 'bg-red-100 text-red-700', Rescheduled: 'bg-amber-100 text-amber-700'
    };
    return map[status] || 'bg-gray-100 text-gray-700';
};

// ── Stage Modal (add / edit) ────────────────────────────────────────────────────
function StageModal({ stage, onClose, onSave }) {
    const [form, setForm] = useState({
        stageName: stage?.stageName || 'Online Assessment',
        customStageName: stage?.customStageName || '',
        scheduledAt: stage?.scheduledAt ? new Date(stage.scheduledAt).toISOString().slice(0, 16) : '',
        interviewerName: stage?.interviewerName || '',
        mode: stage?.mode || 'Video Call',
        meetingLink: stage?.meetingLink || '',
        status: stage?.status || 'Pending',
        notes: stage?.notes || ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true); setError('');
        try {
            await onSave({ ...form, scheduledAt: form.scheduledAt || null });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save stage');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-900">{stage ? 'Edit Stage' : 'Add Interview Stage'}</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700">Stage</label>
                        <select value={form.stageName} onChange={update('stageName')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none">
                            {STAGE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {form.stageName === 'Custom' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700">Custom Stage Name</label>
                            <input value={form.customStageName} onChange={update('customStageName')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Date & Time</label>
                            <input type="datetime-local" value={form.scheduledAt} onChange={update('scheduledAt')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Interviewer Name</label>
                            <input value={form.interviewerName} onChange={update('interviewerName')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Mode</label>
                            <select value={form.mode} onChange={update('mode')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none">
                                {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Status</label>
                            <select value={form.status} onChange={update('status')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none">
                                {STAGE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Meeting Link</label>
                        <input value={form.meetingLink} onChange={update('meetingLink')} placeholder="https://..." className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Notes / Feedback</label>
                        <textarea value={form.notes} onChange={update('notes')} rows={3} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                    </div>
                    {error && <p className="text-red-500 text-xs">{error}</p>}
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                        <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-slate-800 transition">
                            {submitting ? 'Saving...' : 'Save Stage'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Edit Details Modal ──────────────────────────────────────────────────────────
function EditDetailsModal({ app, onClose, onSave }) {
    const [form, setForm] = useState({
        companyName: app.companyName, jobTitle: app.jobTitle,
        applicationDate: app.applicationDate?.slice(0, 10) || '',
        applicationSource: app.applicationSource, sourceOther: app.sourceOther || '',
        recruiterName: app.recruiter?.name || '', recruiterEmail: app.recruiter?.email || '',
        recruiterPhone: app.recruiter?.phone || '', recruiterLinkedIn: app.recruiter?.linkedIn || '',
        jobLocation: app.jobLocation || '', workMode: app.workMode || 'Onsite',
        salaryMin: app.salaryRange?.min ?? '', salaryMax: app.salaryRange?.max ?? '', currency: app.salaryRange?.currency || 'INR',
        jobDescriptionText: app.jobDescriptionText || '', applicationLink: app.applicationLink || ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true); setError('');
        try {
            await onSave({
                companyName: form.companyName, jobTitle: form.jobTitle, applicationDate: form.applicationDate,
                applicationSource: form.applicationSource, sourceOther: form.sourceOther,
                recruiter: { name: form.recruiterName, email: form.recruiterEmail, phone: form.recruiterPhone, linkedIn: form.recruiterLinkedIn },
                jobLocation: form.jobLocation, workMode: form.workMode,
                salaryRange: { min: form.salaryMin || null, max: form.salaryMax || null, currency: form.currency },
                jobDescriptionText: form.jobDescriptionText, applicationLink: form.applicationLink
            });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-900">Edit Application Details</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium text-slate-700">Company Name</label>
                            <input value={form.companyName} onChange={update('companyName')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" /></div>
                        <div><label className="text-sm font-medium text-slate-700">Job Title</label>
                            <input value={form.jobTitle} onChange={update('jobTitle')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" /></div>
                        <div><label className="text-sm font-medium text-slate-700">Application Date</label>
                            <input type="date" value={form.applicationDate} onChange={update('applicationDate')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" /></div>
                        <div><label className="text-sm font-medium text-slate-700">Source</label>
                            <select value={form.applicationSource} onChange={update('applicationSource')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none">
                                {['LinkedIn', 'Referral', 'Company Website', 'Naukri', 'Indeed', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select></div>
                        <div><label className="text-sm font-medium text-slate-700">Job Location</label>
                            <input value={form.jobLocation} onChange={update('jobLocation')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" /></div>
                        <div><label className="text-sm font-medium text-slate-700">Work Mode</label>
                            <select value={form.workMode} onChange={update('workMode')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none">
                                <option>Onsite</option><option>Remote</option><option>Hybrid</option>
                            </select></div>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Recruiter Details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input placeholder="Name" value={form.recruiterName} onChange={update('recruiterName')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            <input placeholder="Email" value={form.recruiterEmail} onChange={update('recruiterEmail')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            <input placeholder="Phone" value={form.recruiterPhone} onChange={update('recruiterPhone')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            <input placeholder="LinkedIn URL" value={form.recruiterLinkedIn} onChange={update('recruiterLinkedIn')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Salary Range</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <input type="number" placeholder="Min" value={form.salaryMin} onChange={update('salaryMin')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            <input type="number" placeholder="Max" value={form.salaryMax} onChange={update('salaryMax')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            <input placeholder="Currency" value={form.currency} onChange={update('currency')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                    </div>
                    <div><label className="text-sm font-medium text-slate-700">Application Link</label>
                        <input value={form.applicationLink} onChange={update('applicationLink')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" /></div>
                    <div><label className="text-sm font-medium text-slate-700">Job Description</label>
                        <textarea value={form.jobDescriptionText} onChange={update('jobDescriptionText')} rows={3} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" /></div>
                    {error && <p className="text-red-500 text-xs">{error}</p>}
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                        <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-slate-800 transition">
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const DOC_LABELS = { resume: 'Resume', coverLetter: 'Cover Letter', jobDescriptionFile: 'Job Description', offerLetter: 'Offer Letter' };

// ── Main Page ──────────────────────────────────────────────────────────────────
function JobApplicationDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);

    const [app, setApp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [stageModal, setStageModal] = useState(null); // 'new' | stage object | null
    const [editModal, setEditModal] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [followUp, setFollowUp] = useState({ date: '', note: '', completed: false });
    const [offer, setOffer] = useState({ ctc: '', joiningDate: '', compensationNotes: '' });
    const fileInputs = useRef({});

    const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

    const fetchApp = async () => {
        try {
            const { data } = await api.get(`/job-applications/${id}`);
            setApp(data.data);
            setFollowUp({
                date: data.data.followUp?.date ? new Date(data.data.followUp.date).toISOString().slice(0, 16) : '',
                note: data.data.followUp?.note || '',
                completed: data.data.followUp?.completed || false
            });
            setOffer({
                ctc: data.data.offer?.ctc || '',
                joiningDate: data.data.offer?.joiningDate ? data.data.offer.joiningDate.slice(0, 10) : '',
                compensationNotes: data.data.offer?.compensationNotes || ''
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load application');
        } finally { setLoading(false); }
    };

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchApp();
    }, [user, id]);

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
    }
    if (error || !app) {
        return <div className="text-center py-20 text-slate-500">{error || 'Application not found'}</div>;
    }

    const updateStatus = async (status) => {
        try {
            const { data } = await api.put(`/job-applications/${id}`, { status });
            setApp(data.data);
            flash(`Status updated to ${status}`);
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to update status');
        }
    };

    const saveDetails = async (payload) => {
        const { data } = await api.put(`/job-applications/${id}`, payload);
        setApp(data.data);
        flash('Application details updated');
    };

    const deleteApplication = async () => {
        if (!window.confirm('Delete this application? This cannot be undone.')) return;
        try {
            await api.delete(`/job-applications/${id}`);
            navigate('/interview-tracker');
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to delete');
        }
    };

    const saveStage = async (form) => {
        if (stageModal === 'new') {
            const { data } = await api.post(`/job-applications/${id}/stages`, form);
            setApp(data.data);
            flash('Stage added');
        } else {
            const { data } = await api.put(`/job-applications/${id}/stages/${stageModal._id}`, form);
            setApp(data.data);
            flash('Stage updated');
        }
    };

    const deleteStage = async (stageId) => {
        if (!window.confirm('Delete this interview stage?')) return;
        try {
            const { data } = await api.delete(`/job-applications/${id}/stages/${stageId}`);
            setApp(data.data);
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to delete stage');
        }
    };

    const addNote = async (e) => {
        e.preventDefault();
        if (!noteText.trim()) return;
        try {
            const { data } = await api.post(`/job-applications/${id}/notes`, { note: noteText });
            setApp(data.data);
            setNoteText('');
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to add note');
        }
    };

    const uploadDoc = async (docType, file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);
        try {
            const { data } = await api.post(`/job-applications/${id}/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setApp(data.data);
            flash('Document uploaded');
        } catch (err) {
            flash(err.response?.data?.message || 'Upload failed');
        }
    };

    const removeDoc = async (docType, docId) => {
        try {
            const url = docId
                ? `/job-applications/${id}/documents/additional/${docId}`
                : `/job-applications/${id}/documents/${docType}`;
            const { data } = await api.delete(url);
            setApp(data.data);
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to remove document');
        }
    };

    const saveFollowUp = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.put(`/job-applications/${id}/follow-up`, followUp);
            setApp(data.data);
            flash('Follow-up saved');
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to save follow-up');
        }
    };

    const saveOffer = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.put(`/job-applications/${id}`, { offer });
            setApp(data.data);
            flash('Offer details saved');
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to save offer');
        }
    };

    const sortedStages = [...(app.stages || [])].sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
    const showOfferSection = ['Offer Received', 'Accepted'].includes(app.status);

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-6">
                <Link to="/interview-tracker" className="text-sm text-slate-500 hover:text-slate-800">← Back to Interview Tracker</Link>

                {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-medium text-sm">{successMsg}</div>
                )}

                {/* Header */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{app.jobTitle}</h1>
                        <p className="text-slate-500 mt-1">{app.companyName} • {app.jobLocation || '—'} • {app.workMode}</p>
                        <p className="text-xs text-slate-400 mt-1">Applied {new Date(app.applicationDate).toLocaleDateString()} via {app.applicationSource === 'Other' ? app.sourceOther : app.applicationSource}</p>
                        {app.applicationLink && <a href={app.applicationLink} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline mt-1 inline-block">View job posting →</a>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <select value={app.status} onChange={e => updateStatus(e.target.value)} className={`px-3 py-1.5 rounded-full text-xs font-bold border-0 outline-none ${statusColor(app.status)}`}>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={() => setEditModal(true)} className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 transition text-slate-700">Edit Details</button>
                            <button onClick={deleteApplication} className="px-3 py-2 text-xs font-medium rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition">Delete</button>
                        </div>
                    </div>
                </div>

                {/* Recruiter info */}
                {(app.recruiter?.name || app.recruiter?.email) && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="text-sm font-bold text-slate-700 mb-3">Recruiter</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600">
                            {app.recruiter.name && <p><span className="text-slate-400">Name:</span> {app.recruiter.name}</p>}
                            {app.recruiter.email && <p><span className="text-slate-400">Email:</span> {app.recruiter.email}</p>}
                            {app.recruiter.phone && <p><span className="text-slate-400">Phone:</span> {app.recruiter.phone}</p>}
                            {app.recruiter.linkedIn && <a href={app.recruiter.linkedIn} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">LinkedIn →</a>}
                        </div>
                    </div>
                )}

                {/* Interview Stages */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                        <h2 className="text-lg font-bold text-slate-900">Interview Stages</h2>
                        <button onClick={() => setStageModal('new')} className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800">+ Add Stage</button>
                    </div>
                    {sortedStages.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">No interview stages added yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {sortedStages.map(stage => (
                                <div key={stage._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-start justify-between flex-wrap gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-slate-800 text-sm">{stage.stageName === 'Custom' ? stage.customStageName : stage.stageName}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stageStatusColor(stage.status)}`}>{stage.status}</span>
                                            </div>
                                            {stage.scheduledAt && <p className="text-xs text-slate-500 mt-1">📅 {new Date(stage.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                                            {stage.interviewerName && <p className="text-xs text-slate-500">Interviewer: {stage.interviewerName}</p>}
                                            <p className="text-xs text-slate-400">{stage.mode}{stage.meetingLink && <> • <a href={stage.meetingLink} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Join link</a></>}</p>
                                            {stage.notes && <p className="text-xs text-slate-600 mt-2 bg-white p-2 rounded-lg border border-slate-100">{stage.notes}</p>}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setStageModal(stage)} className="text-xs text-slate-500 hover:text-slate-800 font-medium">Edit</button>
                                            <button onClick={() => deleteStage(stage._id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Documents */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Documents</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(DOC_LABELS).map(([key, label]) => {
                            const doc = app.documents?.[key];
                            return (
                                <div key={key} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">{label}</p>
                                        {doc?.path ? (
                                            <a href={`${FILE_BASE}${doc.path}`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">{doc.originalName || 'View file'}</a>
                                        ) : (
                                            <p className="text-xs text-slate-400">No file uploaded</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <input ref={el => fileInputs.current[key] = el} type="file" className="hidden" onChange={e => e.target.files[0] && uploadDoc(key, e.target.files[0])} />
                                        <button onClick={() => fileInputs.current[key]?.click()} className="text-xs text-slate-600 hover:text-slate-900 font-medium">{doc?.path ? 'Replace' : 'Upload'}</button>
                                        {doc?.path && <button onClick={() => removeDoc(key)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Additional Documents</p>
                        <div className="space-y-2">
                            {(app.documents?.additionalDocuments || []).map(doc => (
                                <div key={doc._id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                                    <a href={`${FILE_BASE}${doc.path}`} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">{doc.label}</a>
                                    <button onClick={() => removeDoc('additional', doc._id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                                </div>
                            ))}
                            <input ref={el => fileInputs.current['additional'] = el} type="file" className="hidden" onChange={e => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const label = window.prompt('Label for this document', file.name) || file.name;
                                const formData = new FormData();
                                formData.append('file', file);
                                formData.append('docType', 'additional');
                                formData.append('label', label);
                                api.post(`/job-applications/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
                                    .then(({ data }) => { setApp(data.data); flash('Document uploaded'); })
                                    .catch(err => flash(err.response?.data?.message || 'Upload failed'));
                            }} />
                            <button onClick={() => fileInputs.current['additional']?.click()} className="text-xs text-slate-600 hover:text-slate-900 font-medium">+ Add document</button>
                        </div>
                    </div>
                </div>

                {/* Prep Notes */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Prep Notes & Questions Asked</h2>
                    <form onSubmit={addNote} className="flex gap-2 mb-4">
                        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Add a prep note or question asked..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 self-start">Add</button>
                    </form>
                    {(app.prepNotes || []).length === 0 ? (
                        <p className="text-sm text-slate-400">No notes yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {[...app.prepNotes].reverse().map(n => (
                                <div key={n._id} className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                                    <p>{n.note}</p>
                                    <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Follow-up & Offer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Recruiter Follow-up</h2>
                        <form onSubmit={saveFollowUp} className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Follow-up Date</label>
                                <input type="datetime-local" value={followUp.date} onChange={e => setFollowUp(f => ({ ...f, date: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Note</label>
                                <textarea value={followUp.note} onChange={e => setFollowUp(f => ({ ...f, note: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={followUp.completed} onChange={e => setFollowUp(f => ({ ...f, completed: e.target.checked }))} />
                                Completed
                            </label>
                            <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800">Save Follow-up</button>
                        </form>
                    </div>

                    {showOfferSection && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-6">
                            <h2 className="text-lg font-bold text-slate-900 mb-4">Offer Details</h2>
                            <form onSubmit={saveOffer} className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">CTC</label>
                                    <input value={offer.ctc} onChange={e => setOffer(o => ({ ...o, ctc: e.target.value }))} placeholder="e.g. 18 LPA" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Joining Date</label>
                                    <input type="date" value={offer.joiningDate} onChange={e => setOffer(o => ({ ...o, joiningDate: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Compensation Notes</label>
                                    <textarea value={offer.compensationNotes} onChange={e => setOffer(o => ({ ...o, compensationNotes: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                                </div>
                                <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800">Save Offer</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            {stageModal && (
                <StageModal
                    stage={stageModal === 'new' ? null : stageModal}
                    onClose={() => setStageModal(null)}
                    onSave={saveStage}
                />
            )}
            {editModal && (
                <EditDetailsModal app={app} onClose={() => setEditModal(false)} onSave={saveDetails} />
            )}

        </>
    );
}

export default JobApplicationDetail;
