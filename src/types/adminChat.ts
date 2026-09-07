import { Timestamp } from 'firebase/firestore';

export type AdminChatSender = 'user' | 'admin';

export interface AdminThread {
    userId: string;
    userEmail: string;
    userName: string;
    userPhoto?: string;
    lastMessage: string;
    lastMessageAt: Timestamp;
    lastSender: AdminChatSender;
    awaitingAdminReply: boolean;
    unreadByAdmin: boolean;
    unreadByUser: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface AdminChatMessage {
    id: string;
    from: AdminChatSender;
    fromUid: string;
    text: string;
    createdAt: Timestamp;
}
