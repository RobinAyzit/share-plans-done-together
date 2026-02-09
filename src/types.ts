import { Timestamp } from 'firebase/firestore';

export interface Reaction {
    emoji: string;
    userId: string;
    userName: string;
}

export interface Item {
    id: string;
    text: string;
    checked: boolean;
    checkedBy?: string;
    checkedByUid?: string;
    imageUrl?: string;
    reactions?: Reaction[];
}

export interface PlanMember {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: Timestamp;
}

export interface Plan {
    id: string;
    name: string;
    ownerId: string;
    members: { [uid: string]: PlanMember };
    items: Item[];
    created: Timestamp;
    completed: boolean;
    completedAt?: Timestamp;
    lastModified: Timestamp;
    imageUrl?: string;
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    friends: string[];
    createdAt: Timestamp;
    fcmTokens?: string[];
    language?: string;
}

export interface PlanInvite {
    id: string;
    planId: string;
    planName: string;
    createdBy: string;
    createdByName: string;
    createdAt: Timestamp;
    expiresAt: Timestamp | null;
    maxUses: number | null;
    useCount: number;
}

export interface FriendRequest {
    id: string;
    from: string;
    fromEmail: string;
    fromName: string;
    fromPhoto?: string;
    to: string;
    toEmail: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Timestamp;
}
