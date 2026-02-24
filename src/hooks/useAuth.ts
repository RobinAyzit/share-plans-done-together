import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type User, signOut as firebaseSignOut, GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../types';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { i18n } = useTranslation();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            try {
                setUser(firebaseUser);
                if (firebaseUser) {
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const profile = userSnap.data() as UserProfile;
                        setUserProfile(profile);
                        
                        // Sync language from profile if it exists and is different
                        // But only if we are on initial load (loading is true) or if the profile language is explicitly set
                        // We check i18n.language against profile.language to avoid unnecessary updates
                        if (profile.language && profile.language !== i18n.language) {
                            i18n.changeLanguage(profile.language);
                        }
                    } else {
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
            } catch (err) {
                console.error('Auth state change error:', err);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const signInWithGoogle = async () => {
        try {
            setLoading(true);
            setError(null);
            
            if (Capacitor.isNativePlatform()) {
                const googleUser = await GoogleAuth.signIn();
                const idToken = googleUser.authentication.idToken;
                
                if (!idToken) {
                    throw new Error("No idToken received from Google Auth");
                }
                
                const credential = GoogleAuthProvider.credential(idToken);
                await signInWithCredential(auth, credential);
            } else {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({
                    prompt: 'select_account'
                });
                
                await signInWithPopup(auth, provider);
            }
            
        } catch (err: any) {
            console.error('Sign in error:', err);
            const errorMessage = err.message || "Something went wrong";
            setError(`Inloggning misslyckades: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setError(null);
            await firebaseSignOut(auth);
            if (Capacitor.isNativePlatform()) {
                await GoogleAuth.signOut();
            }
        } catch (err: any) {
            console.error('Sign out error:', err);
            setError('Utloggning misslyckades');
        }
    };

    return {
        user,
        userProfile,
        loading,
        error,
        signInWithGoogle,
        signOut,
        isAuthenticated: !!user
    };
}
