import { useEffect, useState, useCallback } from 'react';

// Real, enforceable fullscreen tracking via the Fullscreen API. Note this can
// only detect/encourage fullscreen — it cannot stop a user from pressing Esc
// or a window-manager shortcut to exit; that's surfaced as a violation, not blocked.
export default function useFullscreenGuard(enabled, onExit) {
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    const requestFullscreen = useCallback(() => {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        const handleChange = () => {
            const fs = !!document.fullscreenElement;
            setIsFullscreen(fs);
            if (!fs) onExit();
        };
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, [enabled, onExit]);

    return { isFullscreen, requestFullscreen };
}
