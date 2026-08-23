import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function SellerWebinarAnalytics() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [webinar, setWebinar] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get(`/webinars/${id}/analytics`),
            api.get(`/webinars/${id}`),
        ])
            .then(([analyticsRes, webinarRes]) => {
                setData(analyticsRes.data.data);
                setWebinar(webinarRes.data.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
    }

    const funnelChart = [
        { name: 'Registered', count: data?.registrationCount || 0 },
        { name: 'Attended', count: data?.attendedCount || 0 },
        { name: 'Waitlisted', count: data?.waitlistedCount || 0 },
    ];

    return (
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Webinar Analytics</h1>
                        <p className="text-slate-500 mt-1">{webinar?.name}</p>
                    </div>
                    <Link to="/seller/webinars" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">← Back to Webinars</Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[
                        { label: 'Registrations', value: data?.registrationCount || 0, icon: '👥', gradient: 'from-indigo-500 to-indigo-600' },
                        { label: 'Attendance Rate', value: `${data?.attendanceRate || 0}%`, icon: '✅', gradient: 'from-emerald-500 to-emerald-600' },
                        { label: 'Peak Concurrent', value: data?.peakConcurrentParticipants || 0, icon: '📈', gradient: 'from-violet-500 to-violet-600' },
                        { label: 'Revenue', value: `₹${(data?.revenue || 0).toFixed(2)}`, icon: '💰', gradient: 'from-amber-500 to-amber-600' },
                    ].map(card => (
                        <div key={card.label} className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-6 text-white shadow-lg`}>
                            <div className="text-3xl mb-2">{card.icon}</div>
                            <p className="text-white/70 text-sm">{card.label}</p>
                            <p className="text-3xl font-black mt-1">{card.value}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">Registration Funnel</h2>
                        <p className="text-slate-400 text-sm mb-5">Registered vs. attended vs. waitlisted</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={funnelChart} barCategoryGap="35%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">Engagement</h2>
                        <Row label="Hands raised" value={data?.totalHandRaises || 0} />
                        <Row label="Poll participation rate" value={`${data?.pollParticipationRate || 0}%`} />
                        <Row label="Polls run" value={data?.pollCount || 0} />
                        <Row label="Questions asked" value={data?.questionCount || 0} />
                        <Row label="Questions answered" value={data?.questionsAnswered || 0} />
                        <Row label="Question upvotes" value={data?.questionUpvotes || 0} />
                        <Row label="Resource downloads" value={data?.resourceDownloads || 0} />
                        <Row label="Average rating" value={data?.feedbackCount ? `⭐ ${data.averageRating} (${data.feedbackCount})` : '—'} />
                    </div>
                </div>
            </div>

    );
}

function Row({ label, value }) {
    return (
        <>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm font-bold text-slate-800">{value}</span>
        </div>
        </>
    );
}

export default SellerWebinarAnalytics;
