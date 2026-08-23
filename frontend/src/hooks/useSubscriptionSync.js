/**
 * useSubscriptionSync
 * ─────────────────────────────────────────────────────────────────────────────
 * Keeps the Redux subscription state in sync with the server.
 *
 * Fires on:
 *   • Mount (once, for any logged-in user)
 *   • Page visibility change (tab focus / returning from background)
 *
 * Why this matters: the JWT token doesn't carry subscription data, so Redux
 * loads it from localStorage on boot. If a subscription expires while the tab
 * is open (or the user was logged in on another device that processed a
 * cancellation/refund), the cached state goes stale. This hook corrects it
 * silently — the Pricing page and any discount preview instantly reflect the
 * real server state without requiring a full logout/login cycle.
 *
 * It never throws — errors are swallowed so a network blip can't break the UI.
 */

import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../lib/api';
import { setUser } from '../features/auth/authSlice';

export function useSubscriptionSync() {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const lastFetched = useRef(0);

    const sync = async () => {
        if (!user) return;

        // Throttle: don't re-fetch if we synced within the last 60 seconds
        const now = Date.now();
        if (now - lastFetched.current < 60_000) return;
        lastFetched.current = now;

        try {
            const { data } = await api.get('/payments/subscription/status');
            const fresh = data.data; // { plan, validUntil, isActive, daysRemaining }

            const cached = user.subscription || {};
            const planChanged = cached.plan !== fresh.plan;
            const expiryChanged = String(cached.validUntil) !== String(fresh.validUntil);

            if (planChanged || expiryChanged) {
                dispatch(setUser({
                    subscription: {
                        plan: fresh.plan,
                        validUntil: fresh.validUntil,
                    },
                }));
            }
        } catch {
            // Network or auth errors — silently ignore, stale state is acceptable
        }
    };

    useEffect(() => {
        sync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!user]); // re-run when login state changes

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') sync();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!user]);
}
