import { arrayUnion, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { detectClientPlatform } from './clientPlatform';
import { isDemoMode } from './demoMode';

const INSTALL_ID_KEY = 'dt_install_id';
const INSTALL_SYNCED_KEY = 'dt_install_synced';

function createInstallId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `inst_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateInstallId(): string {
    try {
        const existing = localStorage.getItem(INSTALL_ID_KEY);
        if (existing) return existing;
        const id = createInstallId();
        localStorage.setItem(INSTALL_ID_KEY, id);
        return id;
    } catch {
        return createInstallId();
    }
}

/**
 * Registers this device/browser once on the user's own profile via arrayUnion.
 * Uses existing users/{uid} write rules — no extra Firestore collection needed.
 */
export async function registerAppInstall(uid: string): Promise<void> {
    if (!uid || isDemoMode()) return;

    try {
        if (localStorage.getItem(INSTALL_SYNCED_KEY) === '1') return;
    } catch {
        // continue
    }

    const installId = getOrCreateInstallId();
    const platform = detectClientPlatform();
    const userRef = doc(db, 'users', uid);

    try {
        await updateDoc(userRef, {
            installIds: arrayUnion(installId),
            clientPlatform: platform,
            lastActiveAt: Timestamp.now(),
        });
        try {
            localStorage.setItem(INSTALL_SYNCED_KEY, '1');
        } catch {
            // ignore
        }
    } catch (err) {
        console.warn('[appInstall] register skipped:', err);
    }
}
