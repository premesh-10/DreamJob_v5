import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import RaiseHandQueue from '../../components/webinar/RaiseHandQueue';

const FEATURE_LABELS = {
    chatEnabled: 'Chat',
    privateChatEnabled: 'Private chat',
    qaEnabled: 'Q&A',
    pollsEnabled: 'Polls',
    quizzesEnabled: 'Quizzes',
    reactionsEnabled: 'Reactions',
    raiseHandEnabled: 'Raise hand',
    screenShareAttendeesAllowed: 'Attendee screen share',
    announcementsEnabled: 'Announcements',
};

// Mounted conditionally inside WebinarJoin's room chrome for host/co-host/moderator roles —
// same room/session as the attendee view, not a separate route (mirrors how InterviewRoom
// conditionally renders an "End Interview" button for one of the two fixed parties).
// Every mutating action here calls a Host Control Panel endpoint that itself follows
// authorize → apply via roomService → persist → broadcast; this component just renders state
// and triggers those calls, it never talks to LiveKit directly.
export default function WebinarHostPanel({ sessionId, selfRole, isHostTier, onFeatureToggle }) {
    const [open, setOpen] = useState(true);
    const [tab, setTab] = useState('roster');
    const [roster, setRoster] = useState([]);
    const [waitingRoom, setWaitingRoom] = useState([]);
    const [stats, setStats] = useState(null);
    const [search, setSearch] = useState('');
    const [featureToggles, setFeatureToggles] = useState({});
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        try {
            const [rosterRes, waitingRes, statsRes] = await Promise.all([
                api.get(`/webinar-sessions/${sessionId}/host/roster`, { params: search ? { q: search } : {} }),
                api.get(`/webinar-sessions/${sessionId}/host/waiting-room`),
                api.get(`/webinar-sessions/${sessionId}/host/stats`),
            ]);
            setRoster(rosterRes.data.data || []);
            setWaitingRoom(waitingRes.data.data || []);
            setStats(statsRes.data.data || null);
        } catch { /* transient poll failure — next tick recovers */ }
    }, [sessionId, search]);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [refresh]);

    const run = async (fn) => {
        setError('');
        try {
            await fn();
            refresh();
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed');
        }
    };

    const start = () => run(() => api.post(`/webinar-sessions/${sessionId}/host/start`));
    const end = () => { if (confirm('End this webinar for everyone?')) run(() => api.post(`/webinar-sessions/${sessionId}/host/end`)); };
    const toggleLock = (locked) => run(() => api.post(`/webinar-sessions/${sessionId}/host/${locked ? 'unlock' : 'lock'}`));
    const admit = (userId) => run(() => api.post(`/webinar-sessions/${sessionId}/host/waiting-room/admit`, { userId }));
    const deny = (userId) => run(() => api.post(`/webinar-sessions/${sessionId}/host/waiting-room/deny`, { userId }));
    const removeP = (userId) => { if (confirm('Remove this participant from the webinar?')) run(() => api.post(`/webinar-sessions/${sessionId}/host/remove`, { userId })); };
    const mute = (userId, muted) => run(() => api.post(`/webinar-sessions/${sessionId}/host/${muted ? 'unmute' : 'mute'}`, { userId }));
    const muteAll = () => run(() => api.post(`/webinar-sessions/${sessionId}/host/mute-all`));
    const toggleCam = (userId, disabled) => run(() => api.post(`/webinar-sessions/${sessionId}/host/camera`, { userId, disabled: !disabled }));
    const promote = (userId) => run(() => api.post(`/webinar-sessions/${sessionId}/host/speaker`, { userId }));
    const demote = (userId) => run(() => api.delete(`/webinar-sessions/${sessionId}/host/speaker`, { data: { userId } }));
    const spotlight = (userId) => run(() => api.post(`/webinar-sessions/${sessionId}/host/spotlight`, { userId }));

    const flipFeature = async (feature, enabled) => {
        setError('');
        try {
            const { data } = await api.patch(`/webinar-sessions/${sessionId}/host/feature`, { feature, enabled });
            setFeatureToggles(data.data);
            onFeatureToggle?.(data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed');
        }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className="absolute bottom-4 left-4 z-30 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full shadow-lg">
                🎛️ Host Panel
            </button>
        );
    }

    return (
        <div className="absolute bottom-0 left-0 z-30 w-full sm:w-[420px] sm:max-h-[70vh] bg-slate-900 border-t sm:border border-slate-700 sm:rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
                <h3 className="text-sm font-bold text-white">🎛️ Host Control Panel</h3>
                <div className="flex items-center gap-2">
                    {isHostTier && stats && (
                        <button onClick={() => toggleLock(stats.locked)} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stats.locked ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                            {stats.locked ? '🔒 Locked' : '🔓 Unlocked'}
                        </button>
                    )}
                    <button onClick={() => setOpen(false)} aria-label="Close host panel" title="Close host panel" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400">✕</button>
                </div>
            </div>

            {error && <div className="px-4 py-2 bg-red-900/40 text-red-300 text-xs">{error}</div>}

            {stats && (
                <div className="grid grid-cols-4 gap-1 px-4 py-2 border-b border-slate-700 text-center">
                    <Stat label="Live" value={stats.connectedCount} />
                    <Stat label="Peak" value={stats.peakConcurrentParticipants} />
                    <Stat label="Hands" value={stats.handsRaisedCount} />
                    <Stat label="Waiting" value={stats.waitingRoomCount} />
                </div>
            )}

            <div className="flex border-b border-slate-700 flex-shrink-0" role="tablist" aria-label="Host panel sections">
                {['roster', 'waiting', 'hands', 'settings'].map(t => (
                    <button key={t} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}
                        className={`flex-1 py-2 text-xs font-semibold capitalize ${tab === t ? 'text-white border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}>
                        {t}{t === 'waiting' && waitingRoom.length > 0 ? ` (${waitingRoom.length})` : ''}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {tab === 'roster' && (
                    <>
                        {isHostTier && (
                            <div className="flex gap-2 mb-2">
                                {stats?.roomStatus !== 'active' && <button onClick={start} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg">Start Webinar</button>}
                                <button onClick={muteAll} className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">Mute All</button>
                                <button onClick={end} className="flex-1 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-lg">End</button>
                            </div>
                        )}
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participants…"
                            className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-1.5 mb-2 outline-none" />
                        {roster.filter(p => p.connectionState === 'connected').map(p => (
                            <div key={p.identity} className="flex items-center justify-between gap-2 bg-slate-800 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-200 truncate">{p.user?.name || 'Participant'} <span className="text-slate-500 text-xs capitalize">({p.role})</span></p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => mute(p.identity, p.isMuted)} title="Mute/unmute" aria-label={p.isMuted ? 'Unmute participant' : 'Mute participant'} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded">{p.isMuted ? '🔇' : '🎙️'}</button>
                                    <button onClick={() => toggleCam(p.identity, p.camDisabled)} title="Camera" aria-label={p.camDisabled ? 'Enable camera' : 'Disable camera'} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded">{p.camDisabled ? '📷🚫' : '📷'}</button>
                                    <button onClick={() => spotlight(p.identity)} title="Spotlight" aria-label="Spotlight participant" className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded">⭐</button>
                                    {isHostTier && p.role === 'attendee' && <button onClick={() => promote(p.identity)} title="Promote to speaker" aria-label="Promote to speaker" className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded">🎤+</button>}
                                    {isHostTier && p.role === 'speaker' && <button onClick={() => demote(p.identity)} title="Demote" aria-label="Demote from speaker" className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded">🎤-</button>}
                                    {isHostTier && p.role !== 'host' && <button onClick={() => removeP(p.identity)} title="Remove" aria-label="Remove participant" className="px-2 py-1 bg-rose-800 hover:bg-rose-700 text-white text-xs rounded">✕</button>}
                                </div>
                            </div>
                        ))}
                        {roster.filter(p => p.connectionState === 'connected').length === 0 && <p className="text-xs text-slate-500 text-center py-4">No one connected yet</p>}
                    </>
                )}

                {tab === 'waiting' && (
                    <>
                        {waitingRoom.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No one waiting</p>}
                        {waitingRoom.map(e => (
                            <div key={e.user._id} className="flex items-center justify-between gap-2 bg-slate-800 rounded-lg px-3 py-2">
                                <span className="text-sm text-slate-200 truncate">{e.user?.name || 'User'}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={() => admit(e.user._id)} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded">Admit</button>
                                    <button onClick={() => deny(e.user._id)} className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded">Deny</button>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {tab === 'hands' && <RaiseHandQueue roster={roster} onInviteToSpeak={promote} />}

                {tab === 'settings' && isHostTier && (
                    <div className="space-y-1.5">
                        {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                            <label key={key} className="flex items-center justify-between gap-2 bg-slate-800 rounded-lg px-3 py-2 cursor-pointer">
                                <span className="text-sm text-slate-200">{label}</span>
                                <input
                                    type="checkbox"
                                    checked={featureToggles[key] !== false}
                                    onChange={e => flipFeature(key, e.target.checked)}
                                    className="rounded"
                                />
                            </label>
                        ))}
                    </div>
                )}
                {tab === 'settings' && !isHostTier && <p className="text-xs text-slate-500 text-center py-4">Only the host or co-host can change feature settings</p>}
            </div>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div>
            <p className="text-sm font-bold text-white">{value ?? 0}</p>
            <p className="text-[10px] text-slate-500 uppercase">{label}</p>
        </div>
    );
}
