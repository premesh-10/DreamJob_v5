import { useEffect, useRef } from 'react';

// Detects real tab-switch / window-blur events via the Page Visibility API.
// This is a genuinely reliable signal for "the user navigated away from this
// tab" — but it cannot detect a hard browser-kill, and a second monitor with
// another window visible alongside this one won't trigger it either.
export default function useTabSwitchGuard(enabled, onSwitch) {
    const wasHidden = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        const handleVisibility = () => {
            if (document.hidden) {
                wasHidden.current = true;
                onSwitch('switch_away');
            } else if (wasHidden.current) {
                wasHidden.current = false;
                onSwitch('switch_back');
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [enabled, onSwitch]);
}
