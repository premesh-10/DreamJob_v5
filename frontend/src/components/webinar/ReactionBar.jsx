import { useState } from 'react';
import api from '../../lib/api';

const EMOJIS = [
    { emoji: '👏', label: 'Clap' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '😂', label: 'Laugh' },
    { emoji: '😮', label: 'Surprised' },
    { emoji: '👍', label: 'Thumbs up' },
    { emoji: '🎉', label: 'Celebrate' },
];

// Fire-and-forget — the 202 response means the server already queued the persist+broadcast;
// we don't wait for anything before showing the local burst animation.
export default function ReactionBar({ sessionId }) {
    const [bursts, setBursts] = useState([]);

    const send = (emoji) => {
        const id = Date.now() + Math.random();
        setBursts(b => [...b, { id, emoji }]);
        setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 1500);
        api.post(`/webinar-sessions/${sessionId}/reactions`, { emoji }).catch(() => {});
    };

    return (
        <div className="relative">
            <div className="flex gap-1.5 px-2 py-1.5 bg-slate-900/80 rounded-full">
                {EMOJIS.map(({ emoji, label }) => (
                    <button key={emoji} onClick={() => send(emoji)} aria-label={`React with ${label}`} title={label} className="text-lg hover:scale-125 transition-transform">{emoji}</button>
                ))}
            </div>
            <div className="absolute bottom-full left-0 right-0 flex justify-center pointer-events-none">
                {bursts.map(b => (
                    <span key={b.id} className="text-2xl absolute animate-bounce" style={{ animationDuration: '1.2s' }}>{b.emoji}</span>
                ))}
            </div>
        </div>
    );
}
