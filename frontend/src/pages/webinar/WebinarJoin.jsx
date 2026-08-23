import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import '@livekit/components-styles';
import { LiveKitRoom, VideoConference, PreJoin, useConnectionState, useDataChannel, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import api from '../../lib/api';
import WebinarCountdown from '../../components/webinar/WebinarCountdown';
import EngagementSidebar from '../../components/webinar/EngagementSidebar';
import ReactionBar from '../../components/webinar/ReactionBar';
import RaiseHandButton from '../../components/webinar/RaiseHandButton';
import ReportModal from '../../components/webinar/ReportModal';
import WebinarHostPanel from './WebinarHostPanel';

const HOST_TIER = ['host', 'co-host'];
const MODERATION_TIER = ['host', 'co-host', 'moderator'];

function getScheduleStart(webinar) {
    const [hh, mm] = (webinar.time || '00:00').split(':').map(Number);
    const start = new Date(webinar.date);
    start.setHours(hh, mm, 0, 0);
    return start;
}

function ConnectionBanner() {
    const state = useConnectionState();
    if (state === ConnectionState.Connected) return null;
    const label = {
        [ConnectionState.Connecting]: 'Connecting…',
        [ConnectionState.Reconnecting]: 'Connection lost — reconnecting…',
        [ConnectionState.Disconnected]: 'Disconnected',
        [ConnectionState.SignalReconnecting]: 'Reconnecting…',
    }[state] || state;
    return (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-xs font-semibold py-1">
            {label}
        </div>
    );
}

// Inner room chrome — rendered inside <LiveKitRoom>, so LiveKit hooks here have room context.
// Subscribes to 'webinar-control' for self-applicable broadcasts from the Host Control Panel
// (muted-by-host banner, role-changed re-render, ended/removed graceful disconnect, live
// feature-toggle flips) — every one of these reflects state that was already applied
// server-side before the broadcast fired (see webinarBroadcast.js), so a dropped message just
// means the local UI is briefly stale, never wrong about what's actually allowed.
function RoomChrome({ webinar, role: initialRole, session, sessionId, selfUserId }) {
    const [showSidebar, setShowSidebar] = useState(true);
    const [role, setRole] = useState(initialRole);
    const [featureToggles, setFeatureToggles] = useState(session?.featureToggles || {});
    const [banner, setBanner] = useState('');
    const [reportTarget, setReportTarget] = useState(null);
    const room = useRoomContext();

    useDataChannel('webinar-control', (msg) => {
        try {
            const payload = JSON.parse(new TextDecoder().decode(msg.payload));
            switch (payload.type) {
                case 'role_changed':
                    if (payload.userId === selfUserId && payload.role) {
                        setRole(payload.role);
                        setBanner(`You are now a ${payload.role}`);
                    }
                    break;
                case 'muted':
                    if (payload.userId === selfUserId) setBanner('You were muted by the host');
                    break;
                case 'cam_toggled':
                    if (payload.userId === selfUserId && payload.disabled) setBanner('Your camera was disabled by the host');
                    break;
                case 'removed':
                    setBanner('You were removed from this webinar');
                    // room.disconnect() triggers LiveKitRoom's onDisconnected, which owns navigation.
                    setTimeout(() => room.disconnect(), 1500);
                    break;
                case 'webinar_ended':
                    setBanner('The host ended this webinar');
                    setTimeout(() => room.disconnect(), 1500);
                    break;
                case 'feature_toggled':
                    setFeatureToggles(prev => ({ ...prev, [payload.feature]: payload.enabled }));
                    break;
                default: break;
            }
        } catch { /* ignore malformed packets */ }
    });

    useEffect(() => {
        if (!banner) return;
        const t = setTimeout(() => setBanner(''), 4000);
        return () => clearTimeout(t);
    }, [banner]);

    const isHostTier = HOST_TIER.includes(role);
    const isModerationTier = MODERATION_TIER.includes(role);

    return (
        <>
            <ConnectionBanner />
            {banner && <div className="absolute top-9 left-0 right-0 z-50 bg-indigo-600 text-white text-center text-xs font-semibold py-1">{banner}</div>}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
                <span className="px-2.5 py-1 bg-slate-900/80 text-white text-xs font-semibold rounded-full capitalize">{role}</span>
                <span className="px-2.5 py-1 bg-slate-900/80 text-slate-200 text-xs font-medium rounded-full max-w-xs truncate">{webinar.name}</span>
            </div>

            <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
                {featureToggles.reactionsEnabled !== false && <ReactionBar sessionId={sessionId} />}
                {featureToggles.raiseHandEnabled !== false && <RaiseHandButton sessionId={sessionId} />}
                <button onClick={() => setReportTarget({ targetType: 'Webinar', targetId: webinar._id, label: 'Report this webinar' })}
                    title="Report this webinar" aria-label="Report this webinar"
                    className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-semibold rounded-full">
                    🚩 Report
                </button>
                <button onClick={() => setShowSidebar(s => !s)} className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-semibold rounded-full">
                    💬 {showSidebar ? 'Hide' : 'Show'} Panel
                </button>
            </div>

            <VideoConference />
            {showSidebar && (
                <EngagementSidebar
                    sessionId={sessionId}
                    featureToggles={featureToggles}
                    resources={webinar.resources || []}
                    webinarId={webinar._id}
                    selfUserId={selfUserId}
                    onReportParticipant={(targetId) => setReportTarget({ targetType: 'WebinarParticipant', targetId, label: 'Report this participant' })}
                />
            )}
            {isModerationTier && (
                <WebinarHostPanel sessionId={sessionId} selfRole={role} isHostTier={isHostTier} onFeatureToggle={setFeatureToggles} />
            )}
            {reportTarget && (
                <ReportModal
                    targetType={reportTarget.targetType}
                    targetId={reportTarget.targetId}
                    webinarId={webinar._id}
                    label={reportTarget.label}
                    onClose={() => setReportTarget(null)}
                />
            )}
        </>
    );
}

function WaitingRoomScreen({ webinar }) {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
            <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xl font-semibold">You're in the waiting room</p>
            <p className="text-slate-400 max-w-md">The host will let you into <strong>{webinar.name}</strong> shortly. This page will update automatically.</p>
        </div>
    );
}

function WebinarJoin() {
    const { webinarId } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(s => s.auth);
    const [webinar, setWebinar] = useState(null);
    const [session, setSession] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stage, setStage] = useState('loading'); // loading | early | waiting_room | denied | prejoin | room | ended
    const [tokenInfo, setTokenInfo] = useState(null);
    const [userChoices, setUserChoices] = useState(null);
    const pollRef = useRef(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            try {
                const [webinarRes, sessionRes] = await Promise.all([
                    api.get(`/webinars/${webinarId}`),
                    api.get(`/webinar-sessions/webinar/${webinarId}`),
                ]);
                setWebinar(webinarRes.data.data);
                setSession(sessionRes.data.data);
                setRole(sessionRes.data.role);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load webinar session');
            } finally {
                setLoading(false);
            }
        })();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [user, webinarId]);

    useEffect(() => {
        if (!webinar || !session || !role) return;

        if (webinar.status === 'cancelled') { setStage('ended'); return; }

        const isElevated = ['host', 'co-host', 'moderator', 'speaker', 'platform_admin'].includes(role);
        if (!isElevated) {
            const start = getScheduleStart(webinar);
            const joinBeforeMins = webinar.settings?.security?.joinBeforeHostMinutes ?? 15;
            const windowStart = dayjs(start).subtract(joinBeforeMins, 'minute');
            if (dayjs().isBefore(windowStart)) {
                setStage('early');
                return;
            }
        }
        setStage('prejoin');
    }, [webinar, session, role]);

    const pollAdmission = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const { data } = await api.post(`/webinar-sessions/${session._id}/admission`);
                if (data.data.status === 'admitted') {
                    clearInterval(pollRef.current);
                    setStage('prejoin');
                } else if (data.data.status === 'denied') {
                    clearInterval(pollRef.current);
                    setStage('denied');
                }
            } catch { /* keep polling — transient errors shouldn't kill the wait screen */ }
        }, 5000);
    }, [session]);

    const requestToken = async () => {
        setError('');
        try {
            const { data } = await api.post(`/webinar-sessions/${session._id}/token`);
            if (data.waiting) {
                setStage('waiting_room');
                pollAdmission();
                return;
            }
            setTokenInfo(data.data);
            setStage('room');
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to join right now');
        }
    };

    if (loading || stage === 'loading') {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (error && !webinar) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
                <p className="text-red-400">{error}</p>
                <Link to="/webinars" className="text-indigo-400 hover:underline">← Back to Webinars</Link>
            </div>
        );
    }

    if (stage === 'ended') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                <p className="text-xl font-semibold">This webinar has been cancelled</p>
                <Link to="/webinars" className="text-indigo-400 hover:underline">← Back to Webinars</Link>
            </div>
        );
    }

    if (stage === 'denied') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                <p className="text-xl font-semibold">🚫 Entry denied</p>
                <p className="text-slate-400">The host did not admit you into this webinar.</p>
                <Link to="/webinars" className="text-indigo-400 hover:underline">← Back to Webinars</Link>
            </div>
        );
    }

    if (stage === 'early') {
        const start = getScheduleStart(webinar);
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3 text-center px-6">
                <p className="text-xl font-semibold">🔒 Not open yet</p>
                <p className="text-slate-400">Starts in <WebinarCountdown start={start} className="font-bold text-white" /></p>
                <p className="text-slate-300">{dayjs(start).format('MMM D, YYYY h:mm A')}</p>
                <Link to="/webinars" className="text-indigo-400 hover:underline mt-2">← Back to Webinars</Link>
            </div>
        );
    }

    if (stage === 'waiting_room') {
        return <WaitingRoomScreen webinar={webinar} />;
    }

    if (stage === 'prejoin') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6" data-lk-theme="default">
                <div className="w-full max-w-lg">
                    {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div>}
                    <PreJoin
                        defaults={{ username: user?.name || '' }}
                        onSubmit={(values) => { setUserChoices(values); requestToken(); }}
                        onError={(err) => setError(err.message)}
                    />
                </div>
            </div>
        );
    }

    if (stage === 'room' && tokenInfo?.token) {
        if (!tokenInfo.liveKitUrl) {
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3 text-center px-6">
                    <p className="text-xl font-semibold">Video service unavailable</p>
                    <p className="text-slate-400">LiveKit isn't configured on this server yet. Access was granted successfully (token issued) — once LIVEKIT_URL/API_KEY/API_SECRET are configured, the live video room will connect here automatically.</p>
                    <Link to="/webinars" className="text-indigo-400 hover:underline mt-2">← Back to Webinars</Link>
                </div>
            );
        }
        return (
            <div className="h-screen w-screen relative bg-slate-950" data-lk-theme="default">
                <LiveKitRoom
                    token={tokenInfo.token}
                    serverUrl={tokenInfo.liveKitUrl}
                    connect={true}
                    video={userChoices?.videoEnabled ?? true}
                    audio={userChoices?.audioEnabled ?? true}
                    onDisconnected={() => navigate(role === 'attendee' ? `/webinar-room/${webinarId}/feedback` : '/webinars')}
                    style={{ height: '100%' }}
                >
                    <RoomChrome webinar={webinar} role={role} session={session} sessionId={session._id} selfUserId={user?.id} />
                </LiveKitRoom>
            </div>
        );
    }

    return null;
}

export default WebinarJoin;
