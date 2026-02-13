import { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    Timestamp,
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FriendRequest, UserProfile } from '../types';
import { sendAppNotification } from '../lib/notifications';

export function useFriends(userId: string | undefined) {
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(() => !!userId);

    useEffect(() => {
        if (!userId) {
            return;
        }

        const userRef = doc(db, 'users', userId);

        const unsubscribe = onSnapshot(userRef, async (snapshot) => {
            if (!snapshot.exists()) {
                setFriends([]);
                setLoading(false);
                return;
            }

            const userData = snapshot.data() as UserProfile;
            const friendIds = userData.friends || [];

            if (friendIds.length === 0) {
                setFriends([]);
                setLoading(false);
                return;
            }

            // Fetch friend profiles
            const friendProfiles = await Promise.all(
                friendIds.map(async (friendId) => {
                    const friendDoc = await getDoc(doc(db, 'users', friendId));
                    return friendDoc.exists() ? (friendDoc.data() as UserProfile) : null;
                })
            );

            setFriends(friendProfiles.filter((f): f is UserProfile => f !== null));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    return { friends, loading };
}

export function useFriendRequests(userId: string | undefined) {
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(() => !!userId);

    useEffect(() => {
        if (!userId) {
            return;
        }

        // Listen to incoming requests
        const incomingQuery = query(
            collection(db, 'friendRequests'),
            where('to', '==', userId),
            where('status', '==', 'pending')
        );

        const unsubscribe1 = onSnapshot(incomingQuery, (snapshot) => {
            const requests: FriendRequest[] = [];
            snapshot.forEach((doc) => {
                requests.push({ id: doc.id, ...doc.data() } as FriendRequest);
            });
            setIncomingRequests(requests);
            setLoading(false);
        });

        // Listen to outgoing requests
        const outgoingQuery = query(
            collection(db, 'friendRequests'),
            where('from', '==', userId),
            where('status', '==', 'pending')
        );

        const unsubscribe2 = onSnapshot(outgoingQuery, (snapshot) => {
            const requests: FriendRequest[] = [];
            snapshot.forEach((doc) => {
                requests.push({ id: doc.id, ...doc.data() } as FriendRequest);
            });
            setOutgoingRequests(requests);
        });

        return () => {
            unsubscribe1();
            unsubscribe2();
        };
    }, [userId]);

    return { incomingRequests, outgoingRequests, loading };
}

export async function searchUserByEmail(email: string): Promise<UserProfile | null> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    return snapshot.docs[0].data() as UserProfile;
}

export async function sendFriendRequest(
    fromUser: UserProfile,
    toUser: UserProfile
): Promise<void> {
    // Check if request already exists
    const existingQuery = query(
        collection(db, 'friendRequests'),
        where('from', '==', fromUser.uid),
        where('to', '==', toUser.uid),
        where('status', '==', 'pending')
    );
    const existing = await getDocs(existingQuery);

    if (!existing.empty) {
        throw new Error('Friend request already sent');
    }

    // Check if they're already friends
    if (fromUser.friends.includes(toUser.uid)) {
        throw new Error('Already friends');
    }

    // Create friend request
    await addDoc(collection(db, 'friendRequests'), {
        from: fromUser.uid,
        fromEmail: fromUser.email,
        fromName: fromUser.displayName,
        fromPhoto: fromUser.photoURL || '',
        to: toUser.uid,
        toEmail: toUser.email,
        status: 'pending',
        createdAt: Timestamp.now(),
    });

    // Send notification
    await sendAppNotification(
        toUser.uid,
        'Ny vänförfrågan! 👋',
        `${fromUser.displayName} vill lägga till dig som vän.`,
        'friend_request'
    );
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) return;

    const request = requestSnap.data() as FriendRequest;

    // Add each user to the other's friends list
    const fromUserRef = doc(db, 'users', request.from);
    const toUserRef = doc(db, 'users', request.to);

    await updateDoc(fromUserRef, {
        friends: arrayUnion(request.to),
    });

    await updateDoc(toUserRef, {
        friends: arrayUnion(request.from),
    });

    // Update request status
    await updateDoc(requestRef, {
        status: 'accepted',
    });

    // Send notification to the sender that the request was accepted
    await sendAppNotification(
        request.from,
        'Vänförfrågan accepterad! 🎉',
        `${request.toEmail} har accepterat din förfrågan.`,
        'friend_request'
    );
}

export async function declineFriendRequest(requestId: string): Promise<void> {
    const requestRef = doc(db, 'friendRequests', requestId);
    await updateDoc(requestRef, {
        status: 'declined',
    });
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const friendRef = doc(db, 'users', friendId);

    await updateDoc(userRef, {
        friends: arrayRemove(friendId),
    });

    await updateDoc(friendRef, {
        friends: arrayRemove(userId),
    });
}
