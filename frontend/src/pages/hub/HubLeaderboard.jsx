import { useState, useEffect } from 'react';
import api from '../../lib/api';

const levelColor = (level) => ({
    Explorer: 'bg-slate-100 text-slate-700', Trailblazer: 'bg-emerald-100 text-emerald-700',
    Achiever: 'bg-blue-100 text-blue-700', Expert: 'bg-violet-100 text-violet-700',
    Master: 'bg-amber-100 text-amber-700', Legend: 'bg-rose-100 text-rose-700', Guru: 'bg-indigo-100 text-indigo-700',
}[level] || 'bg-slate-100 text-slate-700');

const MEDAL = ['🥇', '🥈', '🥉'];

function HubLeaderboard() {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/experiences/leaderboard', { params: { limit: 50 } })
            .then(r => setLeaders(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">🏆 Top Contributors</h1>
                    <p className="text-slate-500 mt-1">Ranked by contribution points earned across the Interview Experience Hub</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : leaders.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400">No contributors yet — be the first!</div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                        {leaders.map((u, i) => (
                            <div key={u._id} className="flex items-center gap-4 p-4">
                                <span className="w-8 text-center text-lg font-bold text-slate-400">{MEDAL[i] || i + 1}</span>
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 flex-shrink-0 overflow-hidden">
                                    {u.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900">{u.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${levelColor(u.level)}`}>{u.level}</span>
                                        {u.nextLevel && <span className="text-xs text-slate-400">{u.pointsToNextLevel} pts to {u.nextLevel}</span>}
                                    </div>
                                </div>
                                <span className="text-lg font-bold text-slate-900">{u.points}<span className="text-xs text-slate-400 font-normal ml-1">pts</span></span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </>
    );
}

export default HubLeaderboard;
