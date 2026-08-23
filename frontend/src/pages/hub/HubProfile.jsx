import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';

const levelColor = (level) => ({
    Explorer: 'bg-slate-100 text-slate-700', Trailblazer: 'bg-emerald-100 text-emerald-700',
    Achiever: 'bg-blue-100 text-blue-700', Expert: 'bg-violet-100 text-violet-700',
    Master: 'bg-amber-100 text-amber-700', Legend: 'bg-rose-100 text-rose-700', Guru: 'bg-indigo-100 text-indigo-700',
}[level] || 'bg-slate-100 text-slate-700');

const REASON_LABEL = {
    experience_submitted: 'Shared an interview experience', experience_liked: 'Like on your experience',
    experience_featured: 'Your experience was featured!', experience_removed_penalty: 'Content removed (penalty)',
    comment_posted: 'Posted a comment', comment_liked: 'Like on your comment',
    reward_redeemed: 'Redeemed a reward', admin_adjustment: 'Admin adjustment',
};

function HubProfile() {
    const { user } = useSelector(s => s.auth);
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        Promise.all([
            api.get('/experiences/me/gamification'),
            api.get('/experiences/me/bookmarks'),
        ]).then(([g, b]) => {
            setProfile(g.data.data);
            setBookmarks(b.data.data || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [user]);

    if (loading || !profile) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">My Hub Profile</h1>

                {/* Points & level */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <p className="text-indigo-100 text-sm">Contribution Points</p>
                            <h2 className="text-4xl font-bold">{profile.points}</h2>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-bold ${levelColor(profile.level)}`}>{profile.level}</span>
                    </div>
                    {profile.nextLevel && (
                        <div className="mt-4">
                            <div className="flex justify-between text-xs text-indigo-100 mb-1">
                                <span>{profile.level}</span><span>{profile.nextLevel} ({profile.pointsToNextLevel} pts to go)</span>
                            </div>
                            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full" style={{ width: `${profile.progressPercent}%` }} />
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3 mt-5">
                        <Link to="/interview-hub/rewards" className="px-4 py-2 bg-white text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition">🎁 Redeem Rewards</Link>
                        <Link to="/interview-hub/submit" className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/30 transition">+ Share Another Experience</Link>
                    </div>
                </div>

                {/* Badges */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="font-bold text-slate-900 mb-4">🎖️ Badges Earned</h2>
                    <div className="flex flex-wrap gap-2">
                        {profile.badges.map(b => (
                            <span key={b} className={`px-3 py-1.5 rounded-full text-sm font-bold ${levelColor(b)}`}>{b}</span>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center"><p className="text-2xl font-bold text-slate-900">{profile.experienceCount}</p><p className="text-xs text-slate-500">Experiences Shared</p></div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center"><p className="text-2xl font-bold text-slate-900">{profile.commentCount}</p><p className="text-xs text-slate-500">Comments Posted</p></div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center"><p className="text-2xl font-bold text-slate-900">{bookmarks.length}</p><p className="text-xs text-slate-500">Bookmarked</p></div>
                </div>

                {/* Recent activity */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="font-bold text-slate-900 mb-4">Recent Points Activity</h2>
                    {profile.recentTransactions.length === 0 ? <p className="text-sm text-slate-400">No activity yet.</p> : (
                        <div className="space-y-2">
                            {profile.recentTransactions.map(t => (
                                <div key={t._id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                                    <span className="text-slate-600">{REASON_LABEL[t.reason] || t.description || t.reason}</span>
                                    <span className={`font-bold ${t.points >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{t.points >= 0 ? '+' : ''}{t.points}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bookmarks */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="font-bold text-slate-900 mb-4">🔖 Bookmarked Experiences</h2>
                    {bookmarks.length === 0 ? <p className="text-sm text-slate-400">No bookmarks yet.</p> : (
                        <div className="space-y-2">
                            {bookmarks.map(exp => (
                                <Link key={exp._id} to={`/interview-hub/experiences/${exp._id}`} className="block p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                                    <p className="text-sm font-medium text-slate-800">{exp.jobRole} @ {exp.company?.name}</p>
                                    <p className="text-xs text-slate-400">by {exp.user?.name}</p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}

export default HubProfile;
