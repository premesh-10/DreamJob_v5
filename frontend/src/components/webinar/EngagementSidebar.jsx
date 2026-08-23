import { useState, useEffect, useRef } from 'react';
import { useDataChannel } from '@livekit/components-react';
import api from '../../lib/api';

// Tabbed Chat/Q&A/Polls sidebar. Every outgoing action goes through REST (persist first);
// useDataChannel here is receive-only — it's the low-latency "go re-fetch/append X" signal
// fired by the server *after* its own write is durable (see backend/utils/webinarBroadcast.js),
// never the source of truth itself.
//
// No host moderation controls here (answer question / open / close poll) — those mount inside
// the Host Control Panel starting Phase 7. This phase just makes engagement work for everyone.
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
const getFileUrl = (path) => path ? (path.startsWith('http') ? path : `${API_BASE}${path}`) : '';

export default function EngagementSidebar({ sessionId, featureToggles = {}, resources = [], selfUserId, onReportParticipant }) {
    const [tab, setTab] = useState('chat');
    const [messages, setMessages] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [polls, setPolls] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [questionInput, setQuestionInput] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        if (featureToggles.chatEnabled !== false) {
            api.get(`/webinar-sessions/${sessionId}/chat`).then(({ data }) => setMessages(data.data || [])).catch(() => {});
        }
        if (featureToggles.qaEnabled !== false) {
            api.get(`/webinar-sessions/${sessionId}/questions`).then(({ data }) => setQuestions(data.data || [])).catch(() => {});
        }
        if (featureToggles.pollsEnabled !== false) {
            api.get(`/webinar-sessions/${sessionId}/polls`).then(({ data }) => setPolls(data.data || [])).catch(() => {});
        }
    }, [sessionId]);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, tab]);

    useDataChannel('webinar-engagement', (msg) => {
        try {
            const payload = JSON.parse(new TextDecoder().decode(msg.payload));
            switch (payload.type) {
                case 'chat_message':
                    setMessages(prev => [...prev, payload.message]);
                    break;
                case 'question_asked':
                    setQuestions(prev => [payload.question, ...prev]);
                    break;
                case 'question_upvoted':
                    setQuestions(prev => prev.map(q => q._id === payload.questionId ? { ...q, upvoteCount: payload.upvoteCount } : q));
                    break;
                case 'question_answered':
                    setQuestions(prev => prev.map(q => q._id === payload.questionId ? { ...q, status: payload.status, answerText: payload.answerText } : q));
                    break;
                case 'poll_opened':
                    setPolls(prev => [...prev.filter(p => p._id !== payload.poll._id), { ...payload.poll, status: 'open', options: payload.poll.options.map(o => ({ ...o, votes: [] })) }]);
                    setTab('polls');
                    break;
                case 'poll_vote_update':
                    setPolls(prev => prev.map(p => p._id === payload.pollId
                        ? { ...p, options: p.options.map(o => ({ ...o, votes: Array((payload.counts.find(c => c._id === o._id) || {}).count || 0) })) }
                        : p));
                    break;
                case 'poll_closed':
                    setPolls(prev => prev.map(p => p._id === payload.pollId ? { ...p, status: 'closed', participationRate: payload.participationRate } : p));
                    break;
                default: break;
            }
        } catch { /* ignore malformed packets */ }
    });

    const sendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        api.post(`/webinar-sessions/${sessionId}/chat`, { text: chatInput.trim() }).catch(() => {});
        setChatInput('');
    };

    const sendQuestion = (e) => {
        e.preventDefault();
        if (!questionInput.trim()) return;
        api.post(`/webinar-sessions/${sessionId}/questions`, { text: questionInput.trim() }).catch(() => {});
        setQuestionInput('');
    };

    const upvote = (questionId) => {
        api.post(`/webinar-sessions/${sessionId}/questions/${questionId}/upvote`).catch(() => {});
    };

    const vote = (pollId, optionId) => {
        api.post(`/webinar-sessions/${sessionId}/polls/${pollId}/vote`, { optionId }).catch(() => {});
    };

    const tabs = [
        featureToggles.chatEnabled !== false && { key: 'chat', label: '💬 Chat' },
        featureToggles.qaEnabled !== false && { key: 'qa', label: '❓ Q&A' },
        featureToggles.pollsEnabled !== false && { key: 'polls', label: '📊 Polls' },
        resources.length > 0 && { key: 'resources', label: '📎 Resources' },
    ].filter(Boolean);

    if (tabs.length === 0) return null;

    return (
        <div className="absolute top-0 right-0 h-full w-full sm:w-[360px] bg-slate-900 border-l border-slate-700 z-40 flex flex-col shadow-2xl">
            <div className="flex border-b border-slate-700" role="tablist" aria-label="Engagement sections">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} role="tab" aria-selected={tab === t.key}
                        className={`flex-1 py-2.5 text-xs font-semibold transition ${tab === t.key ? 'text-white border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {messages.map(m => {
                            const senderId = typeof m.sender === 'string' ? m.sender : m.sender?._id;
                            const isSelf = senderId && selfUserId && senderId === selfUserId;
                            return (
                                <div key={m._id} className="text-sm group">
                                    <span className="font-semibold text-indigo-300">{m.sender?.name || m.senderName || 'User'}</span>
                                    <span className="text-slate-500 text-xs ml-1.5 capitalize">{m.senderRole}</span>
                                    {!isSelf && senderId && onReportParticipant && (
                                        <button onClick={() => onReportParticipant(senderId)} title="Report this participant" aria-label="Report this participant"
                                            className="ml-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition text-xs">🚩</button>
                                    )}
                                    <p className="text-slate-200">{m.text}</p>
                                </div>
                            );
                        })}
                        <div ref={bottomRef} />
                    </div>
                    <form onSubmit={sendChat} className="p-2 border-t border-slate-700 flex gap-2">
                        <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Say something…"
                            className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none" />
                        <button type="submit" className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Send</button>
                    </form>
                </>
            )}

            {tab === 'qa' && (
                <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {questions.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No questions yet — be the first to ask!</p>}
                        {questions.map(q => (
                            <div key={q._id} className="bg-slate-800 rounded-xl p-3">
                                <p className="text-slate-200 text-sm">{q.text}</p>
                                <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-xs text-slate-500">{q.isAnonymous ? 'Anonymous' : (q.askedBy?.name || q.askedBy || 'User')}</span>
                                    <button onClick={() => upvote(q._id)} className="text-xs text-indigo-300 hover:text-indigo-200">▲ {q.upvoteCount || 0}</button>
                                </div>
                                {q.status === 'answered' && q.answerText && (
                                    <p className="text-xs text-emerald-300 mt-2 border-t border-slate-700 pt-2">✓ {q.answerText}</p>
                                )}
                            </div>
                        ))}
                    </div>
                    <form onSubmit={sendQuestion} className="p-2 border-t border-slate-700 flex gap-2">
                        <input value={questionInput} onChange={e => setQuestionInput(e.target.value)} placeholder="Ask a question…"
                            className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none" />
                        <button type="submit" className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Ask</button>
                    </form>
                </>
            )}

            {tab === 'polls' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {polls.filter(p => p.status !== 'draft').length === 0 && <p className="text-slate-500 text-sm text-center py-6">No polls yet.</p>}
                    {polls.filter(p => p.status !== 'draft').map(p => {
                        const totalVotes = p.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
                        return (
                            <div key={p._id} className="bg-slate-800 rounded-xl p-3">
                                <p className="text-slate-200 text-sm font-semibold mb-2">{p.question}</p>
                                <div className="space-y-1.5">
                                    {p.options.map(o => {
                                        const count = o.votes?.length || 0;
                                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                        return (
                                            <button key={o._id} disabled={p.status !== 'open'} onClick={() => vote(p._id, o._id)}
                                                className="w-full text-left relative bg-slate-700 rounded-lg overflow-hidden disabled:cursor-default">
                                                <div className="absolute inset-y-0 left-0 bg-indigo-600/40" style={{ width: `${pct}%` }} />
                                                <div className="relative flex items-center justify-between px-3 py-1.5 text-xs text-slate-100">
                                                    <span>{o.text}</span>
                                                    <span>{pct}%</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {p.status === 'closed' && p.participationRate != null && (
                                    <p className="text-xs text-slate-500 mt-2">{p.participationRate}% participation</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === 'resources' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {resources.map(r => (
                        <a key={r._id} href={getFileUrl(r.filePath)} target="_blank" rel="noreferrer"
                            download={r.downloadable ? r.title : undefined}
                            className="flex items-center justify-between gap-2 bg-slate-800 hover:bg-slate-700 rounded-xl p-3 transition">
                            <div className="min-w-0">
                                <p className="text-sm text-slate-200 truncate">{r.title}</p>
                                <p className="text-xs text-slate-500 uppercase">{r.fileType}</p>
                            </div>
                            <span className="text-indigo-300 text-xs font-semibold flex-shrink-0">{r.downloadable ? 'Download' : 'View'}</span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
