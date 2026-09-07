import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isAdminEmail } from '../lib/admin';
import type { ClientPlatform } from '../lib/clientPlatform';
import type { UserProfile } from '../types';

const ONLINE_MS = 5 * 60 * 1000;
const ACTIVE_24H_MS = 24 * 60 * 60 * 1000;
const ACTIVE_7D_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminMetrics {
    totalUsers: number;
    onlineNow: number;
    active24h: number;
    active7d: number;
    installs: number;
    byPlatform: Record<ClientPlatform, number>;
    installsByPlatform: Record<ClientPlatform, number>;
    recentUsers: Array<{
        uid: string;
        displayName: string;
        email: string;
        lastActiveAt: number | null;
        clientPlatform?: ClientPlatform;
    }>;
    fetchedAt: number;
}

const emptyPlatforms = (): Record<ClientPlatform, number> => ({
    android: 0,
    ios: 0,
    pwa: 0,
    web: 0,
});

function toMillis(value: unknown): number | null {
    if (!value) return null;
    if (value instanceof Timestamp) return value.toMillis();
    if (
        typeof value === 'object' &&
        value !== null &&
        'toMillis' in value &&
        typeof (value as Timestamp).toMillis === 'function'
    ) {
        return (value as Timestamp).toMillis();
    }
    return null;
}

async function fetchAdminMetrics(): Promise<AdminMetrics> {
    const usersSnap = await getDocs(collection(db, 'users'));
    const now = Date.now();
    const byPlatform = emptyPlatforms();
    const installsByPlatform = emptyPlatforms();
    const uniqueInstallIds = new Set<string>();

    let onlineNow = 0;
    let active24h = 0;
    let active7d = 0;
    const recentUsers: AdminMetrics['recentUsers'] = [];

    usersSnap.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        const lastMs = toMillis(data.lastActiveAt);
        const platform = (data.clientPlatform as ClientPlatform | undefined) || 'web';

        if (platform in byPlatform) {
            byPlatform[platform] += 1;
        } else {
            byPlatform.web += 1;
        }

        const installIds = Array.isArray(data.installIds) ? data.installIds : [];
        for (const id of installIds) {
            if (typeof id === 'string' && id.length > 0) {
                uniqueInstallIds.add(id);
            }
        }
        // Fallback: count each active user as one install if no installIds yet
        if (installIds.length === 0 && lastMs != null) {
            uniqueInstallIds.add(`legacy_${docSnap.id}`);
            if (platform in installsByPlatform) {
                installsByPlatform[platform] += 1;
            }
        } else if (installIds.length > 0) {
            if (platform in installsByPlatform) {
                installsByPlatform[platform] += installIds.length;
            }
        }

        if (lastMs != null) {
            const age = now - lastMs;
            if (age <= ONLINE_MS) onlineNow += 1;
            if (age <= ACTIVE_24H_MS) active24h += 1;
            if (age <= ACTIVE_7D_MS) active7d += 1;
        }

        recentUsers.push({
            uid: data.uid || docSnap.id,
            displayName: data.displayName || '—',
            email: data.email || '',
            lastActiveAt: lastMs,
            clientPlatform: data.clientPlatform,
        });
    });

    recentUsers.sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0));

    return {
        totalUsers: usersSnap.size,
        onlineNow,
        active24h,
        active7d,
        installs: uniqueInstallIds.size,
        byPlatform,
        installsByPlatform,
        recentUsers: recentUsers.slice(0, 12),
        fetchedAt: now,
    };
}

export function useAdminMetrics(enabled: boolean, email: string | null | undefined) {
    const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const allowed = enabled && isAdminEmail(email);

    const refresh = useCallback(async () => {
        if (!allowed) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminMetrics();
            setMetrics(data);
        } catch (err) {
            console.error('[adminMetrics]', err);
            setError('Kunde inte hämta statistik just nu.');
        } finally {
            setLoading(false);
        }
    }, [allowed]);

    useEffect(() => {
        if (!allowed) {
            setMetrics(null);
            setError(null);
            return;
        }
        void refresh();
    }, [allowed, refresh]);

    return { metrics, loading, error, refresh, allowed };
}
