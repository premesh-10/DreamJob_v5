import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import Editor from '@monaco-editor/react';
import '@livekit/components-styles';
import {
    LiveKitRoom,
    VideoConference,
    PreJoin,
    useIsRecording,
    useConnectionState,
    useRemoteParticipants,
    useDataChannel,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import api from '../lib/api';

const ADMIN_ROLES = ['admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'];

// ── Collaborative code editor — broadcasts the shared buffer over LiveKit's
// data channel (last-writer-wins + periodic full resync), not a CRDT/Yjs
// sync server, since this is a 1:1 interview, not multi-cursor concurrent editing.
function CodeEditorPanel({ onClose }) {
    const [code, setCode] = useState('// Write or paste code here — both participants see live updates.\n');
    const [language, setLanguage] = useState('javascript');
    const skipNextBroadcast = useRef(false);
    const debounceRef = useRef(null);

    const { send } = useDataChannel('code-editor', (msg) => {
        try {
            const text = new TextDecoder().decode(msg.payload);
            const payload = JSON.parse(text);
            if (payload.code !== undefined) {
                skipNextBroadcast.current = true;
                setCode(payload.code);
            }
            if (payload.language) setLanguage(payload.language);
        } catch { /* ignore malformed packets */ }
    });

    const broadcast = useCallback((nextCode, nextLanguage) => {
        const payload = new TextEncoder().encode(JSON.stringify({ code: nextCode, language: nextLanguage }));
        send(payload, { reliable: true });
    }, [send]);

    const handleChange = (value) => {
        setCode(value);
        if (skipNextBroadcast.current) { skipNextBroadcast.current = false; return; }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => broadcast(value, language), 200);
    };

    const handleLanguageChange = (e) => {
        setLanguage(e.target.value);
        broadcast(code, e.target.value);
    };

    return (
        <div className="absolute top-0 right-0 h-full w-full sm:w-[480px] bg-slate-900 border-l border-slate-700 z-40 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">💻 Collaborative Code Editor</span>
                    <select value={language} onChange={handleLanguageChange} className="bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600">
                        {['javascript', 'python', 'java', 'cpp', 'typescript', 'go', 'sql'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-2">✕</button>
            </div>
            <div className="flex-1">
                <Editor
                    height="100%"
                    language={language}
                    value={code}
                    onChange={handleChange}
                    theme="vs-dark"
                    options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: 'on' }}
                />
            </div>
        </div>
    );
}

function RecordingBadge() {
    const isRecording = useIsRecording();
    if (!isRecording) return null;
    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600/90 text-white text-xs font-semibold rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Recording
        </div>
    );
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

function WaitingOverlay({ waitingForName }) {
    return (
        <div className="absolute inset-0 z-30 bg-slate-950/90 flex flex-col items-center justify-center text-white gap-3">
            <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="font-semibold">Waiting for {waitingForName} to join…</p>
            <p className="text-slate-400 text-sm">You're connected — the interview will begin once they arrive.</p>
        </div>
    );
}

// Inner room chrome — rendered inside <LiveKitRoom>, so LiveKit hooks here have room context.
function RoomChrome({ session, role, sessionId, navigate }) {
    const [showCode, setShowCode] = useState(false);
    const [ending, setEnding] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    const remoteParticipants = useRemoteParticipants();

    const otherPartyId = role === 'candidate' ? session.interviewer?._id : session.candidate?._id;
    const otherPartyName = role === 'candidate' ? (session.interviewer?.name || 'the interviewer') : (session.candidate?.name || 'the candidate');
    const otherPartyPresent = role === 'admin' || remoteParticipants.some(p => p.identity === otherPartyId);

    useEffect(() => {
        const tick = () => {
            const diff = dayjs(session.scheduledEnd).diff(dayjs());
            if (diff <= 0) { setTimeLeft('Time is up'); return; }
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${mins}m ${secs}s left`);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [session.scheduledEnd]);

    const endInterview = async () => {
        const confirmMessage = role === 'interviewer'
            ? 'End this interview for both participants?'
            : 'Leave this interview? This will end it for both participants.';
        if (!window.confirm(confirmMessage)) return;
        setEnding(true);
        try {
            await api.post(`/interview-sessions/${sessionId}/end`);
        } catch (err) {
            console.error(err);
            setEnding(false);
        }
    };

    return (
        <>
            <ConnectionBanner />
            {!otherPartyPresent && <WaitingOverlay waitingForName={otherPartyName} />}

            <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
                <span className="px-2.5 py-1 bg-slate-900/80 text-white text-xs font-semibold rounded-full capitalize">{role}</span>
                <span className="px-2.5 py-1 bg-slate-900/80 text-slate-200 text-xs font-medium rounded-full">⏱ {timeLeft}</span>
                <RecordingBadge />
                {role === 'admin' && <span className="px-2.5 py-1 bg-amber-600/90 text-white text-xs font-semibold rounded-full">Moderation view</span>}
            </div>

            <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
                <button onClick={() => setShowCode(s => !s)} className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-semibold rounded-full">
                    💻 Code Editor
                </button>
                {(role === 'interviewer' || role === 'candidate') && (
                    <button onClick={endInterview} disabled={ending} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-full disabled:opacity-60">
                        {ending ? 'Ending…' : (role === 'interviewer' ? 'End Interview' : 'Leave Interview')}
                    </button>
                )}
            </div>

            <VideoConference />
            {showCode && <CodeEditorPanel onClose={() => setShowCode(false)} />}
        </>
    );
}

function ConsentPrompt({ sessionId, onDone }) {
    const [busy, setBusy] = useState(false);
    const respond = async (consent) => {
        if (!consent) { onDone(); return; }
        setBusy(true);
        try { await api.post(`/interview-sessions/${sessionId}/consent`); } catch { /* non-fatal */ }
        finally { setBusy(false); onDone(); }
    };
    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
            <div className="max-w-md bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
                <h2 className="text-lg font-bold">Recording Consent</h2>
                <p className="text-sm text-slate-300">This platform may record mock interviews for quality assurance and your own review. Recording only starts once both participants consent. Do you consent to this interview being recorded?</p>
                <div className="flex gap-3">
                    <button onClick={() => respond(false)} disabled={busy} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold disabled:opacity-60">Decline</button>
                    <button onClick={() => respond(true)} disabled={busy} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold disabled:opacity-60">I Consent</button>
                </div>
            </div>
        </div>
    );
}

function InterviewRoom() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const [session, setSession] = useState(null);
    const [role, setRole] = useState(null);
    const [joinSettings, setJoinSettings] = useState({ interviewJoinWindowMinutesBefore: 15, interviewJoinWindowMinutesAfterEnd: 0, recordingRequiresConsent: true });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stage, setStage] = useState('loading'); // loading | locked | consent | prejoin | connecting | room | ended
    const [tokenInfo, setTokenInfo] = useState(null);
    const [userChoices, setUserChoices] = useState(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            try {
                const [sessionRes, settingsRes] = await Promise.all([
                    api.get(`/interview-sessions/${sessionId}`),
                    api.get('/settings/public'),
                ]);
                setSession(sessionRes.data.data);
                setRole(sessionRes.data.role);
                setJoinSettings(settingsRes.data?.data || joinSettings);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load interview session');
            } finally {
                setLoading(false);
            }
        })();
    }, [user, sessionId]);

    useEffect(() => {
        if (!session) return;
        if (['completed', 'cancelled', 'no_show'].includes(session.completionStatus)) {
            setStage('ended');
            return;
        }
        // Submitting feedback (or a report) is this party's "I'm done" signal —
        // once given, they can't rejoin, even if the session is still
        // 'disputed'/'awaiting_feedback' because the OTHER party hasn't
        // submitted yet. That other party is unaffected and can still join.
        const ownFeedback = role === 'candidate' ? session.candidateFeedback : role === 'interviewer' ? session.interviewerFeedback : null;
        if (ownFeedback) {
            setStage('feedback_given');
            return;
        }
        const now = dayjs();
        const windowStart = dayjs(session.scheduledStart).subtract(joinSettings.interviewJoinWindowMinutesBefore, 'minute');
        const windowEnd = dayjs(session.scheduledEnd).add(joinSettings.interviewJoinWindowMinutesAfterEnd || 0, 'minute');
        if (role !== 'admin' && (now.isBefore(windowStart) || now.isAfter(windowEnd))) {
            setStage('locked');
        } else if (joinSettings.recordingRequiresConsent && role !== 'admin') {
            setStage('consent');
        } else {
            setStage('prejoin');
        }
    }, [session, joinSettings, role]);

    const requestToken = async () => {
        setError('');
        try {
            const { data } = await api.post(`/interview-sessions/${sessionId}/token`);
            setTokenInfo(data.data);
            setStage('room');
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to join right now');
        }
    };

    if (loading || stage === 'loading') {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (error && !session) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
                <p className="text-red-400">{error}</p>
                <Link to="/history" className="text-indigo-400 hover:underline">← Back to Purchase History</Link>
            </div>
        );
    }

    if (stage === 'ended') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                <p className="text-xl font-semibold capitalize">This interview is {session.completionStatus.replace('_', ' ')}</p>
                <Link to="/history" className="text-indigo-400 hover:underline">← Back to Purchase History</Link>
            </div>
        );
    }

    if (stage === 'feedback_given') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                <p className="text-xl font-semibold">You've already submitted feedback for this interview</p>
                <p className="text-slate-400 max-w-sm">Submitting feedback (or reporting an issue) marks your part of this interview as done, so you can't rejoin the room.</p>
                <Link to="/history" className="text-indigo-400 hover:underline">← Back to Purchase History</Link>
            </div>
        );
    }

    if (stage === 'locked') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3 text-center px-6">
                <p className="text-xl font-semibold">🔒 Not open yet</p>
                <p className="text-slate-400">You can join {joinSettings.interviewJoinWindowMinutesBefore} minutes before the scheduled start.</p>
                <p className="text-slate-300">{dayjs(session.scheduledStart).format('MMM D, YYYY h:mm A')} – {dayjs(session.scheduledEnd).format('h:mm A')}</p>
                <Link to="/history" className="text-indigo-400 hover:underline mt-2">← Back to Purchase History</Link>
            </div>
        );
    }

    if (stage === 'consent') {
        return <ConsentPrompt sessionId={sessionId} onDone={() => setStage('prejoin')} />;
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
                    <Link to="/history" className="text-indigo-400 hover:underline mt-2">← Back to Purchase History</Link>
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
                    onDisconnected={async () => {
                        // Covers leaving via the built-in VideoConference control bar (or any
                        // other disconnect path that doesn't go through the explicit End/Leave
                        // button above) — best-effort, so a network hiccup here never blocks
                        // navigation. Without this, completionStatus would only ever flip via
                        // an explicit button click or the up-to-30-minute stuck-session cron
                        // sweep, leaving the feedback form rejecting submissions in between.
                        if (role === 'interviewer' || role === 'candidate') {
                            try { await api.post(`/interview-sessions/${sessionId}/end`); } catch { /* best-effort */ }
                        }
                        navigate(`/interview-room/${sessionId}/feedback`);
                    }}
                    style={{ height: '100%' }}
                >
                    <RoomChrome session={session} role={role} sessionId={sessionId} navigate={navigate} />
                </LiveKitRoom>
            </div>
        );
    }

    return null;
}

export default InterviewRoom;
