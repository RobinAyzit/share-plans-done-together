import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export function useNotifications(userId: string | undefined) {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;

        // 1. Request FCM Token for background push
        if ('Notification' in window) {
            const requestPermission = async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const currentToken = await getToken(messaging, {
                            vapidKey: 'BN4q6ahLqD56ssLIqw8C0CYOb70yDq_7ePfJ8xLO1wL8Uxz9nds2RzRB8gPsJ6_JSq37AxVI-z3ssg11Hz7KU3A'
                        });

                        if (currentToken) {
                            setToken(currentToken);
                            const userRef = doc(db, 'users', userId);
                            await updateDoc(userRef, {
                                fcmTokens: arrayUnion(currentToken)
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error getting notification token:', error);
                }
            };
            requestPermission();
        }

        // 2. Real-time Firestore Listener for "Smart Notifications" 
        // This ensures the user gets a notification even if external push fails
        const q = query(
            collection(db, 'notifications'),
            where('to', '==', userId),
            where('status', '==', 'pending')
        );

        const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();

                    // Show local notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(data.title || 'DoneTogether', {
                            body: data.body,
                            icon: '/DoneTogether/pwa-icon.png'
                        });
                    }

                    // Mark as sent in DB so we don't notify twice
                    updateDoc(change.doc.ref, { status: 'sent' });
                }
            });
        });

        // 3. Handle FCM foreground messages
        const unsubscribeFCM = onMessage(messaging, (payload) => {
            if (payload.notification) {
                new Notification(payload.notification.title || 'DoneTogether', {
                    body: payload.notification.body,
                    icon: '/DoneTogether/pwa-icon.png'
                });
            }
        });

        return () => {
            unsubscribeFirestore();
            unsubscribeFCM();
        };
    }, [userId]);

    return { token };
}
