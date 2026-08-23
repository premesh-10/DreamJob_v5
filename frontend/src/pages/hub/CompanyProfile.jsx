import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import RecommendedPracticeTests from '../../components/practicetests/RecommendedPracticeTests';

const FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
const logoUrl = (logo) => !logo ? null : (logo.startsWith('http') ? logo : `${FILE_BASE}${logo}`);
const RESOURCE_LINK = {
    Course: id => `/courses/${id}`, PracticeTest: id => `/practice-tests/${id}`,
    Interview: () => `/interviews`, Webinar: () => `/webinars`,
};

function StatCard({ label, value, sub }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
            {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
    );
}

function CompanyProfile() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [company, setCompany] = useState(null);
    const [experiences, setExperiences] = useState([]);
    const [topQuestions, setTopQuestions] = useState([]);
    const [filters, setFilters] = useState({ experienceLevel: '', result: '' });
    const [loading, setLoading] = useState(true);

    const fetchCompany = async () => {
        try {
            const { data } = await api.get(`/companies/${slug}`);
            setCompany(data.data);
            return data.data;
        } catch (e) { console.error(e); return null; }
    };

    const fetchExperiences = async (companyId) => {
        const params = { company: companyId, limit: 30 };
        if (filters.experienceLevel) params.experienceLevel = filters.experienceLevel;
        if (filters.result) params.result = filters.result;
        const { data } = await api.get('/experiences', { params });
        setExperiences(data.data || []);
    };

    useEffect(() => {
        setLoading(true);
        fetchCompany().then(async (c) => {
            if (c) {
                await Promise.all([
                    fetchExperiences(c._id),
                    api.get('/experiences/top-questions', { params: { company: c._id, limit: 10 } }).then(r => setTopQuestions(r.data.data || [])),
                ]);
            }
            setLoading(false);
        });
    }, [slug]);

    useEffect(() => { if (company) fetchExperiences(company._id); }, [filters]);

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (!company) return <div className="text-center py-20 text-slate-500">Company not found.</div>;

    const roundTypes = Object.entries(company.stats?.roundTypeCounts || {}).sort((a, b) => b[1] - a[1]);

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <Link to="/interview-hub/companies" className="text-sm text-slate-500 hover:text-slate-800">← All Companies</Link>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5 flex-wrap">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {company.logo ? <img src={logoUrl(company.logo)} alt={company.name} className="w-full h-full object-cover" /> : <span className="text-2xl font-bold text-slate-500">{company.name?.charAt(0)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-slate-900">{company.name} {company.isVerified && <span className="text-primary-500 text-base" title="Verified">✓</span>}</h1>
                        <p className="text-slate-500 text-sm">{company.industry}{company.website && <> • <a href={company.website} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">{company.website}</a></>}</p>
                        {company.description && <p className="text-sm text-slate-600 mt-2">{company.description}</p>}
                    </div>
                    <Link to="/interview-hub/submit" className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition">+ Share Experience</Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Experiences" value={company.stats?.totalExperiences || 0} />
                    <StatCard label="Selection Rate" value={`${company.selectionRate ?? 0}%`} />
                    <StatCard label="Avg. Difficulty" value={`${company.stats?.avgDifficulty || 0}/5`} />
                    <StatCard label="Common Round" value={roundTypes[0]?.[0] || '—'} />
                </div>

                {/* Linked prep resources */}
                {company.linkedResources?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">📚 Prepare for {company.name}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {company.linkedResources.map(r => (
                                r.resourceType === 'External' ? (
                                    <a key={r._id} href={r.url} target="_blank" rel="noreferrer" className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition">
                                        <p className="text-sm font-medium text-slate-800">{r.title}</p>
                                        <p className="text-xs text-slate-400">{r.jobRole || 'External resource'} ↗</p>
                                    </a>
                                ) : (
                                    <button key={r._id} onClick={() => navigate(RESOURCE_LINK[r.resourceType]?.(r.resourceId) || '/')} className="text-left p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition">
                                        <p className="text-sm font-medium text-slate-800">{r.title}</p>
                                        <p className="text-xs text-slate-400">{r.resourceType}{r.jobRole ? ` • ${r.jobRole}` : ''}</p>
                                    </button>
                                )
                            ))}
                        </div>
                    </div>
                )}

                {/* Auto-matched practice tests (independent of seller-curated linkedResources above) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <RecommendedPracticeTests company={company._id} title={`📝 Recommended Practice Tests for ${company.name}`}
                        emptyHint={`No practice tests tagged for ${company.name} yet.`} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <select value={filters.experienceLevel} onChange={e => setFilters(f => ({ ...f, experienceLevel: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                                <option value="">All Levels</option><option>Internship</option><option>Fresher</option><option>Experienced</option>
                            </select>
                            <select value={filters.result} onChange={e => setFilters(f => ({ ...f, result: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                                <option value="">All Results</option><option>Selected</option><option>Rejected</option><option>Pending</option>
                            </select>
                        </div>

                        {experiences.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">No experiences match these filters yet.</div>
                        ) : experiences.map(exp => {
                            const resultColor = { Selected: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700', Pending: 'bg-amber-100 text-amber-700' }[exp.result];
                            return (
                                <Link key={exp._id} to={`/interview-hub/experiences/${exp._id}`} className="block bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-slate-900">{exp.jobRole}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${resultColor}`}>{exp.result}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-2">{exp.experienceLevel} • {exp.interviewMode} • Difficulty {exp.overallDifficulty}/5 • {new Date(exp.interviewDate).toLocaleDateString()}</p>
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span>by {exp.user?.name || 'Anonymous'}</span>
                                        <span className="flex items-center gap-3"><span>❤️ {exp.likesCount}</span><span>💬 {exp.commentsCount}</span></span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-5 h-fit">
                        <h3 className="font-bold text-slate-900 mb-3">Common Rounds</h3>
                        <div className="space-y-2 mb-5">
                            {roundTypes.map(([type, count]) => (
                                <div key={type} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{type}</span>
                                    <span className="text-slate-400 text-xs">{count}</span>
                                </div>
                            ))}
                        </div>
                        <h3 className="font-bold text-slate-900 mb-3">❓ Frequently Asked</h3>
                        <div className="space-y-2">
                            {topQuestions.length === 0 ? <p className="text-xs text-slate-400">Not enough data yet.</p> : topQuestions.map((q, i) => (
                                <div key={i} className="text-sm text-slate-600 p-2 bg-slate-50 rounded-lg flex justify-between gap-2">
                                    <span className="line-clamp-2">{q.question}</span>
                                    <span className="text-xs text-slate-400 flex-shrink-0">×{q.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
}

export default CompanyProfile;
