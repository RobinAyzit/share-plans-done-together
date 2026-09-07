import { Timestamp } from 'firebase/firestore';
import type { FriendRequest, Item, Plan, UserProfile } from '../types';

export const DEMO_AUTH_KEY = 'dt_testsprite_demo_auth';
export const DEMO_UID = 'testsprite-demo-uid';
export const DEMO_EMAIL = 'testsprite.donetogether@gmail.com';
export const DEMO_NAME = 'TestSprite';

const PLANS_KEY = 'dt_demo_plans';
const FRIENDS_KEY = 'dt_demo_friends';
const REQUESTS_KEY = 'dt_demo_friend_requests';
const PLANS_EVENT = 'dt-demo-plans-changed';
const FRIENDS_EVENT = 'dt-demo-friends-changed';

export function isDemoMode(): boolean {
    try {
        return sessionStorage.getItem(DEMO_AUTH_KEY) === '1';
    } catch {
        return false;
    }
}

export function createDemoUserProfile(language = 'en'): UserProfile {
    return {
        uid: DEMO_UID,
        email: DEMO_EMAIL,
        displayName: DEMO_NAME,
        friends: [],
        createdAt: Timestamp.now(),
        language,
    };
}

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function writeJson(key: string, value: unknown, eventName: string) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(eventName));
}

export function seedDemoSocialGraph() {
    const friends = readJson<UserProfile[]>(FRIENDS_KEY, []);
    const requests = readJson<FriendRequest[]>(REQUESTS_KEY, []);

    if (friends.length === 0) {
        writeJson(
            FRIENDS_KEY,
            [
                {
                    uid: 'demo-friend-uid',
                    email: 'demo.friend@example.com',
                    displayName: 'Demo Friend',
                    friends: [DEMO_UID],
                    createdAt: Timestamp.now(),
                },
            ],
            FRIENDS_EVENT
        );
    }

    if (requests.length === 0) {
        writeJson(
            REQUESTS_KEY,
            [
                {
                    id: 'demo-incoming-request',
                    from: 'demo-incoming-uid',
                    fromEmail: 'incoming.user@example.com',
                    fromName: 'Incoming User',
                    fromPhoto: '',
                    to: DEMO_UID,
                    toEmail: DEMO_EMAIL,
                    status: 'pending',
                    createdAt: Timestamp.now(),
                },
            ],
            FRIENDS_EVENT
        );
    }
}

export function clearDemoData() {
    localStorage.removeItem(PLANS_KEY);
    localStorage.removeItem(FRIENDS_KEY);
    localStorage.removeItem(REQUESTS_KEY);
    window.dispatchEvent(new Event(PLANS_EVENT));
    window.dispatchEvent(new Event(FRIENDS_EVENT));
}

export function getDemoPlans(): Plan[] {
    return readJson<Plan[]>(PLANS_KEY, []);
}

export function subscribeDemoPlans(listener: () => void) {
    window.addEventListener(PLANS_EVENT, listener);
    window.addEventListener('storage', listener);
    return () => {
        window.removeEventListener(PLANS_EVENT, listener);
        window.removeEventListener('storage', listener);
    };
}

export function createDemoPlan(
    name: string,
    userId: string,
    userEmail: string,
    userName: string,
    userPhoto?: string,
    imageUrl?: string
): string {
    const id = `demo-plan-${crypto.randomUUID()}`;
    const plan: Plan = {
        id,
        name,
        ownerId: userId,
        members: {
            [userId]: {
                uid: userId,
                email: userEmail || '',
                displayName: userName || 'Owner',
                photoURL: userPhoto,
                role: 'owner',
                joinedAt: Timestamp.now(),
            },
        },
        items: [],
        created: Timestamp.now(),
        completed: false,
        lastModified: Timestamp.now(),
        notificationsEnabled: false,
        imageUrl,
    };
    const plans = getDemoPlans();
    plans.unshift(plan);
    writeJson(PLANS_KEY, plans, PLANS_EVENT);
    return id;
}

function mutatePlan(planId: string, updater: (plan: Plan) => Plan) {
    const plans = getDemoPlans();
    const idx = plans.findIndex((p) => p.id === planId);
    if (idx < 0) return;
    plans[idx] = updater(plans[idx]);
    writeJson(PLANS_KEY, plans, PLANS_EVENT);
}

export function updateDemoPlan(planId: string, updates: Partial<Plan>) {
    mutatePlan(planId, (plan) => {
        const next = { ...plan, ...updates, lastModified: Timestamp.now() };
        if (updates.completed === false) {
            delete next.completedAt;
        }
        return next;
    });
}

export function deleteDemoPlan(planId: string) {
    writeJson(
        PLANS_KEY,
        getDemoPlans().filter((p) => p.id !== planId),
        PLANS_EVENT
    );
}

export function getDemoPlan(planId: string): Plan | null {
    return getDemoPlans().find((p) => p.id === planId) || null;
}

export function addDemoItem(
    planId: string,
    text: string,
    imageUrl?: string,
    location?: Item['location']
) {
    mutatePlan(planId, (plan) => {
        const item: Item = {
            id: crypto.randomUUID(),
            text,
            checked: false,
            imageUrl,
            location,
        };
        return {
            ...plan,
            items: [...plan.items, item],
            completed: false,
            completedAt: undefined,
            lastModified: Timestamp.now(),
        };
    });
}

export function updateDemoItems(planId: string, items: Item[], completed: boolean) {
    mutatePlan(planId, (plan) => ({
        ...plan,
        items,
        completed,
        completedAt: completed ? Timestamp.now() : undefined,
        lastModified: Timestamp.now(),
    }));
}

export function getDemoFriends(): UserProfile[] {
    return readJson<UserProfile[]>(FRIENDS_KEY, []);
}

export function getDemoFriendRequests(): FriendRequest[] {
    return readJson<FriendRequest[]>(REQUESTS_KEY, []);
}

export function subscribeDemoFriends(listener: () => void) {
    window.addEventListener(FRIENDS_EVENT, listener);
    window.addEventListener('storage', listener);
    return () => {
        window.removeEventListener(FRIENDS_EVENT, listener);
        window.removeEventListener('storage', listener);
    };
}

export function searchDemoUserByEmail(email: string): UserProfile | null {
    const normalized = email.trim().toLowerCase();
    if (normalized === DEMO_EMAIL.toLowerCase()) {
        return createDemoUserProfile();
    }
    const known = [
        ...getDemoFriends(),
        {
            uid: 'demo-incoming-uid',
            email: 'incoming.user@example.com',
            displayName: 'Incoming User',
            friends: [],
            createdAt: Timestamp.now(),
        },
        {
            uid: 'demo-searchable-uid',
            email: 'searchable.user@example.com',
            displayName: 'Searchable User',
            friends: [],
            createdAt: Timestamp.now(),
        },
    ];
    return known.find((u) => u.email.toLowerCase() === normalized) || null;
}

export function sendDemoFriendRequest(fromUser: UserProfile, toUser: UserProfile) {
    if (getDemoFriends().some((f) => f.uid === toUser.uid)) {
        throw new Error('Already friends');
    }
    const requests = getDemoFriendRequests();
    if (requests.some((r) => r.from === fromUser.uid && r.to === toUser.uid && r.status === 'pending')) {
        throw new Error('Friend request already sent');
    }
    requests.push({
        id: `demo-req-${crypto.randomUUID()}`,
        from: fromUser.uid,
        fromEmail: fromUser.email,
        fromName: fromUser.displayName,
        fromPhoto: fromUser.photoURL || '',
        to: toUser.uid,
        toEmail: toUser.email,
        status: 'pending',
        createdAt: Timestamp.now(),
    });
    writeJson(REQUESTS_KEY, requests, FRIENDS_EVENT);
}

export function acceptDemoFriendRequest(requestId: string) {
    const requests = getDemoFriendRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;
    req.status = 'accepted';
    writeJson(REQUESTS_KEY, requests, FRIENDS_EVENT);

    const friends = getDemoFriends();
    if (!friends.some((f) => f.uid === req.from)) {
        friends.push({
            uid: req.from,
            email: req.fromEmail,
            displayName: req.fromName,
            photoURL: req.fromPhoto || undefined,
            friends: [DEMO_UID],
            createdAt: Timestamp.now(),
        });
        writeJson(FRIENDS_KEY, friends, FRIENDS_EVENT);
    }
}

export function declineDemoFriendRequest(requestId: string) {
    const requests = getDemoFriendRequests().map((r) =>
        r.id === requestId ? { ...r, status: 'declined' as const } : r
    );
    writeJson(REQUESTS_KEY, requests, FRIENDS_EVENT);
}

export function removeDemoFriend(friendId: string) {
    writeJson(
        FRIENDS_KEY,
        getDemoFriends().filter((f) => f.uid !== friendId),
        FRIENDS_EVENT
    );
}
