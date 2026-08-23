import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../lib/api';

const STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Offer Received', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted'];
const SOURCES = ['LinkedIn', 'Referral', 'Company Website', 'Naukri', 'Indeed', 'Other'];

const CURRENCIES = [
    { symbol: '₹', code: 'INR' },
    { symbol: '$', code: 'USD' },
    { symbol: '€', code: 'EUR' },
    { symbol: '£', code: 'GBP' },
    { symbol: 'A$', code: 'AUD' },
    { symbol: 'C$', code: 'CAD' },
    { symbol: 'S$', code: 'SGD' },
    { symbol: '¥', code: 'JPY' },
    { symbol: '¥', code: 'CNY' },
    { symbol: 'د.إ', code: 'AED' },
    { symbol: '﷼', code: 'SAR' },
    { symbol: '₩', code: 'KRW' },
    { symbol: 'Fr', code: 'CHF' },
    { symbol: 'R$', code: 'BRL' },
];

const getStatusColor = (status) => {
    const map = {
        Applied: 'bg-slate-100 text-slate-700',
        Shortlisted: 'bg-blue-100 text-blue-700',
        Interviewing: 'bg-amber-100 text-amber-700',
        'Offer Received': 'bg-purple-100 text-purple-700',
        Accepted: 'bg-emerald-100 text-emerald-700',
        Rejected: 'bg-red-100 text-red-700',
        Withdrawn: 'bg-slate-200 text-slate-600',
        Ghosted: 'bg-orange-100 text-orange-700'
    };
    return map[status] || 'bg-gray-100 text-gray-700';
};

// ── Add Application Modal ───────────────────────────────────────────────────────
function AddApplicationModal({ onClose, onCreated }) {
    const [form, setForm] = useState({
        companyName: '', jobTitle: '', applicationDate: new Date().toISOString().slice(0, 10),
        applicationSource: 'Company Website', sourceOther: '',
        recruiterName: '', recruiterEmail: '', recruiterPhone: '', recruiterLinkedIn: '',
        jobLocation: '', workMode: 'Onsite',
        salaryMin: '', salaryMax: '', currency: 'INR', currencyOther: '',
        jobDescriptionText: '', applicationLink: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.companyName.trim() || !form.jobTitle.trim()) {
            setError('Company name and job title are required');
            return;
        }
        setSubmitting(true); setError('');
        try {
            await api.post('/job-applications', {
                companyName: form.companyName,
                jobTitle: form.jobTitle,
                applicationDate: form.applicationDate,
                applicationSource: form.applicationSource,
                sourceOther: form.sourceOther,
                recruiter: {
                    name: form.recruiterName, email: form.recruiterEmail,
                    phone: form.recruiterPhone, linkedIn: form.recruiterLinkedIn
                },
                jobLocation: form.jobLocation,
                workMode: form.workMode,
                salaryRange: { min: form.salaryMin || null, max: form.salaryMax || null, currency: form.currency === 'Other' ? (form.currencyOther.trim() || 'Other') : form.currency },
                jobDescriptionText: form.jobDescriptionText,
                applicationLink: form.applicationLink
            });
            onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create application');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-900">Add Job Application</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Company Name *</label>
                            <input value={form.companyName} onChange={update('companyName')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Job Title *</label>
                            <input value={form.jobTitle} onChange={update('jobTitle')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Application Date</label>
                            <input type="date" value={form.applicationDate} onChange={update('applicationDate')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Source</label>
                            <select value={form.applicationSource} onChange={update('applicationSource')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none">
                                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {form.applicationSource === 'Other' && (
                            <div className="col-span-2">
                                <label className="text-sm font-medium text-slate-700">Source (specify)</label>
                                <input value={form.sourceOther} onChange={update('sourceOther')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                            </div>
                        )}
                        <div>
                            <label className="text-sm font-medium text-slate-700">Job Location</label>
                            <input value={form.jobLocation} onChange={update('jobLocation')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Work Mode</label>
                            <select value={form.workMode} onChange={update('workMode')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none">
                                <option>Onsite</option><option>Remote</option><option>Hybrid</option>
                            </select>
                        </div>
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
                            <select value={form.currency} onChange={update('currency')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none bg-white">
                                {CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                                ))}
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        {form.currency === 'Other' && (
                            <input
                                placeholder="Enter currency (e.g. ₺ TRY)"
                                value={form.currencyOther}
                                onChange={update('currencyOther')}
                                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none"
                            />
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700">Application Link</label>
                        <input value={form.applicationLink} onChange={update('applicationLink')} placeholder="https://..." className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Job Description</label>
                        <textarea value={form.jobDescriptionText} onChange={update('jobDescriptionText')} rows={3} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                    </div>

                    {error && <p className="text-red-500 text-xs">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                        <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-slate-800 transition">
                            {submitting ? 'Saving...' : 'Add Application'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
function InterviewTracker() {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('All');
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const params = {};
            if (activeStatus !== 'All') params.status = activeStatus;
            if (search) params.search = search;
            const { data } = await api.get('/job-applications', { params });
            setApplications(data.data || []);
        } catch (error) {
            console.error('Failed to fetch applications', error);
        } finally { setLoading(false); }
    };

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchApplications();
    }, [user, activeStatus]);

    useEffect(() => {
        const t = setTimeout(() => { if (user) fetchApplications(); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    const nextStage = (app) => {
        const now = new Date();
        const upcoming = (app.stages || [])
            .filter(s => s.scheduledAt && new Date(s.scheduledAt) >= now)
            .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
        return upcoming[0];
    };

    const handleCreated = () => {
        setSuccessMsg('Application added successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
        fetchApplications();
    };

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="page-title">Interview Tracker</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Manage your job applications and interview pipeline in one place</p>
                    </div>
                    <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm py-2.5">
                        <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            Add Application
                        </span>
                    </button>
                </div>

                {successMsg && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-medium text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        {successMsg}
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                        {['All', ...STATUSES].map(s => (
                            <button
                                key={s}
                                onClick={() => setActiveStatus(s)}
                                className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${activeStatus === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search company or title…"
                        className="input-field text-sm py-2 w-full md:w-64"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : applications.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 max-w-full">
                        <div className="text-4xl mb-3">📋</div>
                        <p className="text-slate-500 font-medium">No applications yet</p>
                        <button onClick={() => setShowAddModal(true)} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                            Add your first application
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {applications.map(app => {
                            const upcoming = nextStage(app);
                            return (
                                <div
                                    key={app._id}
                                    onClick={() => navigate(`/interview-tracker/${app._id}`)}
                                    className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between flex-wrap gap-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-bold flex-shrink-0">
                                            {app.companyName?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{app.jobTitle}</h3>
                                            <p className="text-sm text-slate-500">{app.companyName} • {app.jobLocation || app.workMode}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Applied {new Date(app.applicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} via {app.applicationSource}</p>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-auto text-left sm:text-right">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(app.status)}`}>{app.status}</span>
                                        {upcoming && (
                                            <p className="text-xs text-slate-500 mt-2">
                                                Next: {upcoming.stageName === 'Custom' ? upcoming.customStageName : upcoming.stageName} — {new Date(upcoming.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showAddModal && (
                <AddApplicationModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
            )}

        </>
    );
}

export default InterviewTracker;
