import { Capacitor } from '@capacitor/core';

export type ClientPlatform = 'android' | 'ios' | 'pwa' | 'web';

export function detectClientPlatform(): ClientPlatform {
    if (Capacitor.isNativePlatform()) {
        const platform = Capacitor.getPlatform();
        if (platform === 'android') return 'android';
        if (platform === 'ios') return 'ios';
        return 'android';
    }

    try {
        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            // iOS Safari installed PWA
            (navigator as Navigator & { standalone?: boolean }).standalone === true;
        if (standalone) return 'pwa';
    } catch {
        // ignore
    }

    return 'web';
}
