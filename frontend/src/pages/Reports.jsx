import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import BadgeShowcase from '../components/practicetests/BadgeShowcase';
import CertificateViewer from '../components/practicetests/CertificateViewer';

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'practice', label: '📝 Practice Tests' },
    { key: 'interviews', label: '🎙️ Interviews' },
    { key: 'achievements', label: '🏆 Achievements' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(secs) {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Practice Test Reports ─────────────────────────────────────────────────────
function PracticeReports() {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/practice-tests/my-attempts/all')
            .then(res => setAttempts(res.data.data || []))
            .catch(() => setError('Failed to load practice test reports.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Loader />;
    if (error) return <ErrorMsg msg={error} />;
    if (attempts.length === 0) return <Empty icon="📝" msg="You haven't taken any practice tests yet." link="/practice-tests" linkLabel="Browse Tests" />;

    const completed = attempts.filter(a => a.status === 'completed');
    const avgPct = completed.length
        ? Math.round(completed.reduce((s, a) => s + a.percentage, 0) / completed.length)
        : 0;
    const passRate = completed.length
        ? Math.round((completed.filter(a => a.passed).length / completed.length) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Attempts', value: attempts.length, icon: '📋', color: 'bg-violet-50 border-violet-200 text-violet-800' },
                    { label: 'Completed', value: completed.length, icon: '✅', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    { label: 'Avg. Score', value: `${avgPct}%`, icon: '🎯', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                    { label: 'Pass Rate', value: `${passRate}%`, icon: '🏆', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                ].map(s => (
                    <div key={s.label} className={`${s.color} border rounded-2xl p-3 sm:p-4 text-center`}>
                        <p className="text-2xl mb-1">{s.icon}</p>
                        <p className="text-xl sm:text-2xl font-black">{s.value}</p>
                        <p className="text-xs font-medium opacity-60 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Attempts List */}
            <div className="space-y-3">
                {attempts.map(attempt => (
                    <div key={attempt._id} className={`bg-white rounded-2xl border-2 p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition hover:shadow-md ${attempt.passed ? 'border-emerald-100' : attempt.status === 'completed' ? 'border-red-100' : 'border-slate-100'}`}>
                        {/* Result Badge */}
                        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black flex-shrink-0 text-sm ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : attempt.status === 'completed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                            {attempt.status === 'completed'
                                ? <><span className="text-2xl">{attempt.percentage}%</span></>
                                : <span className="text-xs uppercase">{attempt.status}</span>
                            }
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{attempt.practiceTest?.title || 'Unknown Test'}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {attempt.practiceTest?.subject} • Attempt #{attempt.attemptNumber} • {formatDate(attempt.createdAt)}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : attempt.status === 'completed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {attempt.status === 'completed' ? (attempt.passed ? '✓ PASS' : '✗ FAIL') : attempt.status}
                                </span>
                                {attempt.status === 'completed' && (
                                    <span className="text-xs text-slate-400">
                                        {attempt.score}/{attempt.totalMarks} marks • {formatDuration(attempt.timeTaken)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* CTA */}
                        {attempt.status === 'completed' && (
                            <Link
                                to={`/practice-tests/${attempt.practiceTest?._id}/attempts/${attempt._id}`}
                                className="w-full sm:w-auto text-center px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-md transition"
                            >
                                View Report →
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Interview Reports ─────────────────────────────────────────────────────────
function InterviewReports() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/interviews/bookings/me')
            .then(res => setBookings(res.data.data || []))
            .catch(() => setError('Failed to load interview reports.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Loader />;
    if (error) return <ErrorMsg msg={error} />;

    // A booking is an interview booking if it has an interview field (not a course)
    const interviews = bookings.filter(b => b.interview || b.type === 'interview');
    if (interviews.length === 0) return <Empty icon="🎙️" msg="You haven't booked any mock interviews yet." link="/interviews" linkLabel="Browse Interviews" />;

    const completed = interviews.filter(b => b.status === 'completed');

    return (
        <div className="space-y-6">
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Booked', value: interviews.length, icon: '📅', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                    { label: 'Completed', value: completed.length, icon: '✅', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    { label: 'Upcoming', value: interviews.filter(b => ['confirmed', 'pending'].includes(b.status)).length, icon: '🔜', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                ].map(s => (
                    <div key={s.label} className={`${s.color} border rounded-2xl p-4 text-center`}>
                        <p className="text-2xl mb-1">{s.icon}</p>
                        <p className="text-2xl font-black">{s.value}</p>
                        <p className="text-xs font-medium opacity-60 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Bookings List */}
            <div className="space-y-3">
                {interviews.map(b => {
                    const slot = b.interview?.slots?.[0];
                    const statusColors = {
                        completed: 'border-emerald-100',
                        confirmed: 'border-blue-100',
                        'in-progress': 'border-amber-100',
                        cancelled: 'border-slate-100',
                        pending: 'border-slate-100',
                    };
                    const badgeColors = {
                        completed: 'bg-emerald-100 text-emerald-700',
                        confirmed: 'bg-blue-100 text-blue-700',
                        'in-progress': 'bg-amber-100 text-amber-700',
                        cancelled: 'bg-slate-100 text-slate-600',
                        pending: 'bg-slate-100 text-slate-600',
                    };

                    return (
                        <div key={b._id} className={`bg-white rounded-2xl border-2 p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition ${statusColors[b.status] || 'border-slate-100'}`}>
                            {/* Icon */}
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl flex-shrink-0">
                                🎙️
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-900 truncate">{b.interview?.title || 'Mock Interview'}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {b.seller?.name && `with ${b.seller.name}`}
                                    {slot?.date && ` • ${formatDate(slot.date)}`}
                                    {` • Booked on ${formatDate(b.createdAt)}`}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${badgeColors[b.status] || 'bg-slate-100 text-slate-600'}`}>
                                        {b.status}
                                    </span>
                                    {b.price > 0 && (
                                        <span className="text-xs text-slate-400">₹{b.price}</span>
                                    )}
                                </div>
                            </div>

                            {/* Rating (if completed and rated) */}
                            {b.status === 'completed' && b.rating && (
                                <div className="flex-shrink-0 text-center">
                                    <div className="text-lg font-black text-amber-500">{'★'.repeat(b.rating)}</div>
                                    <div className="text-xs text-slate-400">Your rating</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Achievements (Badges + Certificates) ────────────────────────────────────────
function AchievementsTab() {
    const [badges, setBadges] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingCert, setViewingCert] = useState(null);

    useEffect(() => {
        Promise.all([api.get('/badges/mine'), api.get('/certificates/mine')])
            .then(([badgesRes, certsRes]) => {
                setBadges(badgesRes.data.data || []);
                setCertificates(certsRes.data.data || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Loader />;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="font-bold text-slate-900 mb-3">Badges</h2>
                <BadgeShowcase earnedBadges={badges} />
            </div>

            <div>
                <h2 className="font-bold text-slate-900 mb-3">Certificates</h2>
                {certificates.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-10">No certificates earned yet — pass a certificate-eligible test to unlock one.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {certificates.map(c => (
                            <div key={c._id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">
                                        {c.course ? '📚 ' : c.webinar ? '🎥 ' : ''}{c.course?.title || c.practiceTest?.title || c.testSeries?.title || c.webinar?.name || 'Certificate'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {c.certificateNumber} • {(c.webinar || c.course) ? '' : `${c.score}% • `}{formatDate(c.issuedAt)}
                                    </p>
                                </div>
                                <button onClick={() => setViewingCert(c)} className="flex-shrink-0 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">View</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {viewingCert && <CertificateViewer certificate={viewingCert} onClose={() => setViewingCert(null)} />}
        </div>
    );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function Loader() {
    return (
        <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

function ErrorMsg({ msg }) {
    return <div className="py-10 text-center text-red-500 font-medium">{msg}</div>;
}

function Empty({ icon, msg, link, linkLabel }) {
    return (
        <div className="py-20 text-center">
            <div className="text-5xl mb-4">{icon}</div>
            <p className="text-slate-500 mb-4">{msg}</p>
            {link && <Link to={link} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition">{linkLabel}</Link>}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function Reports() {
    const [activeTab, setActiveTab] = useState('practice');

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6 py-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl">
                    <h1 className="text-3xl font-black">My Reports</h1>
                    <p className="text-white/75 mt-2">Track your performance across all practice tests and mock interviews.</p>
                </div>

                {/* Tabs */}
                <div className="bg-white border border-slate-200 rounded-2xl p-2 flex gap-2 shadow-sm overflow-x-auto">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex-none whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === t.key ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'practice' ? <PracticeReports /> : activeTab === 'interviews' ? <InterviewReports /> : <AchievementsTab />}
            </div>

        </>
    );
}

export default Reports;
