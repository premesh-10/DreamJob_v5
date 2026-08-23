import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';

const FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
const imgUrl = (img) => !img ? null : (img.startsWith('http') ? img : `${FILE_BASE}${img}`);
const TYPE_ICON = { coupon: '🎟️', subscription_days: '💎', platform_perk: '⭐', physical_gift: '🎁', digital_perk: '📦' };

function HubRewards() {
    const { user } = useSelector(s => s.auth);
    const navigate = useNavigate();
    const [rewards, setRewards] = useState([]);
    const [redemptions, setRedemptions] = useState([]);
    const [points, setPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [redeeming, setRedeeming] = useState(null);
    const [flashMsg, setFlashMsg] = useState('');

    const flash = (msg) => { setFlashMsg(msg); setTimeout(() => setFlashMsg(''), 4000); };

    const fetchAll = async () => {
        const calls = [api.get('/rewards')];
        if (user) {
            calls.push(api.get('/rewards/me/redemptions'));
            calls.push(api.get('/experiences/me/gamification'));
        }
        const results = await Promise.all(calls);
        setRewards(results[0].data.data || []);
        if (user) {
            setRedemptions(results[1].data.data || []);
            setPoints(results[2].data.data.points || 0);
        }
    };

    useEffect(() => { fetchAll().catch(console.error).finally(() => setLoading(false)); }, [user]);

    const redeem = async (reward) => {
        if (!user) { navigate('/login'); return; }
        if (!window.confirm(`Redeem "${reward.title}" for ${reward.pointsCost} points?`)) return;
        setRedeeming(reward._id);
        try {
            const { data } = await api.post(`/rewards/${reward._id}/redeem`);
            flash(data.message);
            setPoints(data.remainingPoints);
            fetchAll();
        } catch (err) {
            flash(err.response?.data?.message || 'Failed to redeem');
        } finally { setRedeeming(null); }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">🎁 Rewards Catalog</h1>
                        <p className="text-slate-500 mt-1">Redeem your contribution points for perks, coupons & more</p>
                    </div>
                    {user && <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold">{points} pts available</div>}
                </div>

                {flashMsg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-medium text-sm">{flashMsg}</div>}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {rewards.length === 0 ? (
                        <p className="text-sm text-slate-400 col-span-full text-center py-10">No rewards available right now — check back soon!</p>
                    ) : rewards.map(r => (
                        <div key={r._id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl mb-3 overflow-hidden">
                                {r.image ? <img src={imgUrl(r.image)} alt={r.title} className="w-full h-full object-cover" /> : TYPE_ICON[r.type]}
                            </div>
                            <h3 className="font-semibold text-slate-900">{r.title}</h3>
                            <p className="text-xs text-slate-500 mt-1 flex-1">{r.description}</p>
                            <div className="flex items-center justify-between mt-4">
                                <span className="font-bold text-indigo-600">{r.pointsCost} pts</span>
                                {r.stock !== null && <span className="text-xs text-slate-400">{r.stock} left</span>}
                            </div>
                            <button onClick={() => redeem(r)} disabled={redeeming === r._id || (user && points < r.pointsCost)}
                                className="mt-3 w-full py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition">
                                {redeeming === r._id ? 'Redeeming...' : (user && points < r.pointsCost) ? 'Not Enough Points' : 'Redeem'}
                            </button>
                        </div>
                    ))}
                </div>

                {user && redemptions.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="font-bold text-slate-900 mb-4">My Redemptions</h2>
                        <div className="space-y-2">
                            {redemptions.map(r => (
                                <div key={r._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                                    <div>
                                        <p className="font-medium text-slate-800">{r.rewardTitleSnapshot}</p>
                                        {r.couponCodeIssued && <p className="text-xs text-primary-600 font-mono">Code: {r.couponCodeIssued}</p>}
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

        </>
    );
}

export default HubRewards;
