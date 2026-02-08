import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyABaCKEfAaQbV458rrwvB4Rq_5Sxd6wbKI",
    authDomain: "testar-6813b.firebaseapp.com",
    projectId: "testar-6813b",
    storageBucket: "testar-6813b.firebasestorage.app",
    messagingSenderId: "1088645153772",
    appId: "1:1088645153772:web:ed07fc9167adb5a490f6c9",
    measurementId: "G-CNQS1R2F5V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true
});
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
    prompt: 'select_account'
});
