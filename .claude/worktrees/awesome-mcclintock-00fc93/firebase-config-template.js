// Firebase Configuration - V88.78
// This file should contain Firebase configuration and API keys
// Make sure there are no variable redeclarations

// Initialize Firebase configuration
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

// Initialize Firebase if needed
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}
