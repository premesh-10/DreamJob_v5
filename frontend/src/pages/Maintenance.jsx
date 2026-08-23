import { useEffect, useState } from 'react';

export default function Maintenance() {
    const [message, setMessage] = useState("We're currently performing scheduled maintenance. We'll be back shortly.");
    const [checking, setChecking] = useState(false);
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem('maintenanceMessage');
        if (stored) {
            setMessage(stored);
            setVerified(true);
            return;
        }
        // User typed /maintenance directly — verify the site is actually down
        fetch('/api/v1/settings/public')
            .then(r => r.json())
            .then(body => {
                if (!body?.data?.maintenanceMode) {
                    window.location.replace('/');
                } else {
                    if (body.data.maintenanceMessage) setMessage(body.data.maintenanceMessage);
                    setVerified(true);
                }
            })
            .catch(() => setVerified(true)); // network error — show the page, something is wrong
    }, []);

    const handleRetry = async () => {
        setChecking(true);
        try {
            const res = await fetch('/api/v1/settings/public');
            if (res.ok) {
                sessionStorage.removeItem('maintenanceMessage');
                window.location.href = '/';
            }
        } catch {}
        setTimeout(() => setChecking(false), 2000);
    };

    if (!verified) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 flex items-center justify-center p-6">
            <div className="max-w-lg w-full text-center">
                {/* Animated gear */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 mb-8">
                    <svg className="w-10 h-10 text-indigo-300 animate-spin" style={{ animationDuration: '8s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-semibold uppercase tracking-widest mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Scheduled Maintenance
                </div>

                <h1 className="text-4xl font-black text-white mb-4 leading-tight">
                    We'll be back<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-violet-300">very soon</span>
                </h1>

                <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-sm mx-auto">
                    {message}
                </p>

                <button onClick={handleRetry} disabled={checking}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition-all disabled:opacity-60 backdrop-blur-sm">
                    {checking ? (
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    )}
                    {checking ? 'Checking...' : 'Check again'}
                </button>

                <p className="text-slate-500 text-xs mt-8">
                    DreamJob &mdash; We're working hard to improve your experience
                </p>
            </div>
        </div>
    );
}
