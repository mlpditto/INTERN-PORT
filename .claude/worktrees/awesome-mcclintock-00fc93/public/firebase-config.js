// Firebase Configuration - V90.70+ Centralized
// This file must be present at public/firebase-config.js for all entry points (user/admin)

const firebaseConfig = {
    apiKey: "AIzaSyCnyZoNfk_YE7TfLeEXFo9GgA-QMj3tv6Q",
    authDomain: "intern-port-edfa7.firebaseapp.com",
    projectId: "intern-port-edfa7",
    storageBucket: "intern-port-edfa7.firebasestorage.app",
    messagingSenderId: "367076866368",
    appId: "1:367076866368:web:9c6559652cb0a78ddce2a5",
    measurementId: "G-5R5CEKCN44"
};

if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

// Export for Node.js (test/dev only)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}

// Make db available globally
if (typeof firebase !== 'undefined') {
    window.db = firebase.firestore();
}
