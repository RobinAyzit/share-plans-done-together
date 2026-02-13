import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type User, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import type { UserProfile } from '../types';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { i18n } = useTranslation();

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const setupAuth = async () => {
            try {
                unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
                    try {
                        setUser(firebaseUser);

                        if (firebaseUser) {
                            // Fetch or create user profile
                            const userRef = doc(db, 'users', firebaseUser.uid);
                            const userSnap = await getDoc(userRef);

                            if (userSnap.exists()) {
                                const profile = userSnap.data() as UserProfile;
                                setUserProfile(profile);
                                // If profile has a language, sync it
                                if (profile.language && profile.language !== i18n.language) {
                                    i18n.changeLanguage(profile.language);
                                }
                            } else {
                                // Create new user profile
                                const newProfile: UserProfile = {
                                    uid: firebaseUser.uid,
                                    email: firebaseUser.email || '',
                                    displayName: firebaseUser.displayName || 'User',
                                    photoURL: firebaseUser.photoURL || undefined,
                                    friends: [],
                                    createdAt: Timestamp.now(),
                                    language: i18n.language || 'en',
                                };
                                await setDoc(userRef, newProfile);
                                setUserProfile(newProfile);
                            }
                        } else {
                            setUserProfile(null);
                        }

                        setLoading(false);
                        setError(null);
                    } catch (innerError) {
                        console.error('Error in auth state change:', innerError);
                        setError(`Firestore-fel: ${innerError instanceof Error ? innerError.message : 'Okänt fel'}`);
                        setLoading(false);
                    }
                });
            } catch (authError) {
                console.error('Firebase Auth initialization error:', authError);
                setError(`Firebase Authentication-fel: ${authError instanceof Error ? authError.message : 'Okänt fel'}. Kontrollera att Authentication är aktiverad i Firebase Console.`);
                setLoading(false);
            }
        };

        setupAuth();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [i18n]);

    const signInWithGoogle = async () => {
        try {
            setError(null);
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ett fel uppstod');
            console.error('Sign in error:', err);
        }
    };

    const signOut = async () => {
        try {
            setError(null);
            await firebaseSignOut(auth);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ett fel uppstod');
            console.error('Sign out error:', err);
        }
    };

    return {
        user,
        userProfile,
        loading,
        error,
        signInWithGoogle,
        signOut,
        isAuthenticated: !!user,
    };
}
