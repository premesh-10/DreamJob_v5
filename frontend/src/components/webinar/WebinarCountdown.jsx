import { useState, useEffect } from 'react';

function useCountdown(targetDate) {
    const [diff, setDiff] = useState(null);
    useEffect(() => {
        if (!targetDate) return;
        const calc = () => setDiff(Math.max(0, new Date(targetDate) - new Date()));
        calc();
        const t = setInterval(calc, 1000);
        return () => clearInterval(t);
    }, [targetDate]);
    return diff;
}

// Reusable countdown display — accepts a resolved start Date/ISO string rather than re-deriving
// date+time+timezone math itself, so callers (the public listing page's own inline countdown,
// or WebinarJoin's pre-live screen) stay in control of how "start" is computed.
export default function WebinarCountdown({ start, className = '' }) {
    const diff = useCountdown(start);
    if (diff === null) return null;
    if (diff <= 0) return <span className={className}>Starting now…</span>;

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    let label;
    if (days > 0) label = `${days}d ${hours}h`;
    else if (hours > 0) label = `${hours}h ${minutes}m`;
    else label = `${minutes}m ${seconds}s`;

    return <span className={className}>{label}</span>;
}
