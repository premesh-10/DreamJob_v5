import { useEffect, useRef } from 'react';

// Best-effort heuristic only — checks whether the outer/inner viewport gap is
// larger than a docked-devtools panel would typically leave. This is NOT a
// reliable detector: undocked devtools, devtools opened via keyboard shortcut
// on some browsers, or a resized window can all produce false positives or
// false negatives. Never present this as "devtools blocked" — only as a
// logged, best-effort signal alongside other proctoring data.
export default function useDevtoolsHeuristic(enabled, onTrigger) {
    const triggeredRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;
        const THRESHOLD = 160;

        const check = () => {
            const widthDiff = window.outerWidth - window.innerWidth;
            const heightDiff = window.outerHeight - window.innerHeight;
            const likelyOpen = widthDiff > THRESHOLD || heightDiff > THRESHOLD;
            if (likelyOpen && !triggeredRef.current) {
                triggeredRef.current = true;
                onTrigger();
            } else if (!likelyOpen) {
                triggeredRef.current = false;
            }
        };

        const interval = setInterval(check, 1500);
        return () => clearInterval(interval);
    }, [enabled, onTrigger]);
}
