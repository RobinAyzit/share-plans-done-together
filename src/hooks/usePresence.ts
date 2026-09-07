import { useEffect, useRef } from 'react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { detectClientPlatform } from '../lib/clientPlatform';
import { registerAppInstall } from '../lib/appInstall';
import { isDemoMode } from '../lib/demoMode';

const HEARTBEAT_MS = 2 * 60 * 1000; // 2 minutes
const MIN_WRITE_GAP_MS = 60 * 1000; // never write more than once per minute

/**
 * Silent background presence for logged-in users.
 * Updates lastActiveAt on the user's own profile — no UI, no impact on others.
 */
export function usePresence(uid: string | undefined) {
    const lastWriteRef = useRef(0);

    useEffect(() => {
        if (!uid || isDemoMode()) return;

        let cancelled = false;
        const userRef = doc(db, 'users', uid);
        const platform = detectClientPlatform();

        const writeHeartbeat = async (force = false) => {
            if (cancelled) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !force) {
                return;
            }

            const now = Date.now();
            if (!force && now - lastWriteRef.current < MIN_WRITE_GAP_MS) return;
            lastWriteRef.current = now;

            try {
                await updateDoc(userRef, {
                    lastActiveAt: Timestamp.now(),
                    clientPlatform: platform,
                });
            } catch (err) {
                // Profile may not exist yet on first tick — ignore quietly
                console.warn('[presence] heartbeat skipped:', err);
            }
        };

        // Install + first heartbeat shortly after login (non-blocking)
        void registerAppInstall(uid);
        const bootTimer = window.setTimeout(() => {
            void writeHeartbeat(true);
        }, 1500);

        const intervalId = window.setInterval(() => {
            void writeHeartbeat(false);
        }, HEARTBEAT_MS);

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                void writeHeartbeat(false);
            }
        };

        const onFocus = () => {
            void writeHeartbeat(false);
        };

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onFocus);

        return () => {
            cancelled = true;
            window.clearTimeout(bootTimer);
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', onFocus);
        };
    }, [uid]);
}
