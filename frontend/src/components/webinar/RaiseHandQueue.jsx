// Host-facing queue of raised hands, with a one-click "invite to speak" that promotes the
// attendee to speaker (mic/cam access) — pulled from the roster the panel already polls,
// so this is a pure presentational filter, not its own data source.
export default function RaiseHandQueue({ roster, onInviteToSpeak }) {
    const raised = roster.filter(p => p.handRaised && p.connectionState === 'connected');

    if (raised.length === 0) {
        return <p className="text-xs text-slate-500 text-center py-4">No raised hands</p>;
    }

    return (
        <div className="space-y-1.5">
            {raised.map(p => (
                <div key={p.identity} className="flex items-center justify-between gap-2 bg-slate-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-slate-200 truncate">✋ {p.user?.name || 'Attendee'}</span>
                    <button
                        onClick={() => onInviteToSpeak(p.identity)}
                        className="flex-shrink-0 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                    >
                        Invite to speak
                    </button>
                </div>
            ))}
        </div>
    );
}
