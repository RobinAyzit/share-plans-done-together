// Import the functions you need from the SDKs you need
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
    apiKey: "AIzaSyABaCKEfAaQbV458rrwvB4Rq_5Sxd6wbKI",
    authDomain: "testar-6813b.firebaseapp.com",
    projectId: "testar-6813b",
    storageBucket: "testar-6813b.firebasestorage.app",
    messagingSenderId: "1088645153772",
    appId: "1:1088645153772:web:ed07fc9167adb5a490f6c9",
    measurementId: "G-CNQS1R2F5V"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/DoneTogether/pwa-icon.png'
    };

    self.registration.showNotification(notificationTitle,
        notificationOptions);
});
