import { useEffect, useRef } from 'react';

// Tracks cumulative time the browser window itself loses focus (distinct from
// a same-window tab switch, which useTabSwitchGuard already covers) via the
// real `blur`/`focus` window events. Reports accumulated lost-focus duration
// periodically rather than on every event, to avoid flooding the server.
export default function useFocusGuard(enabled, onFocusLost) {
    const blurredAtRef = useRef(null);
    const accumulatedRef = useRef(0);

    useEffect(() => {
        if (!enabled) return;

        const onBlur = () => { blurredAtRef.current = Date.now(); };
        const onFocus = () => {
            if (blurredAtRef.current) {
                accumulatedRef.current += Date.now() - blurredAtRef.current;
                blurredAtRef.current = null;
            }
        };
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);

        const flushInterval = setInterval(() => {
            if (accumulatedRef.current > 0) {
                onFocusLost(accumulatedRef.current);
                accumulatedRef.current = 0;
            }
        }, 10000);

        return () => {
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
            clearInterval(flushInterval);
        };
    }, [enabled, onFocusLost]);
}
