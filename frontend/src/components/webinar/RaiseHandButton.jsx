import { useState } from 'react';
import api from '../../lib/api';

export default function RaiseHandButton({ sessionId }) {
    const [raised, setRaised] = useState(false);
    const [busy, setBusy] = useState(false);

    const toggle = async () => {
        setBusy(true);
        try {
            const { data } = await api.patch(`/webinar-sessions/${sessionId}/hand`, { raised: !raised });
            setRaised(data.data.raised);
        } catch (err) {
            // No-op on failure — the user can just try again, this isn't a security-relevant action.
        } finally { setBusy(false); }
    };

    return (
        <button onClick={toggle} disabled={busy}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition disabled:opacity-60 ${raised ? 'bg-amber-500 text-white' : 'bg-slate-900/80 text-white hover:bg-slate-800'}`}>
            ✋ {raised ? 'Hand Raised' : 'Raise Hand'}
        </button>
    );
}
