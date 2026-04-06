// Authentication Module - V88.83
// Handles Google, LINE, and Magic Link authentication

// Firebase Config (V88.63 - Inlined for GitHub Pages)
const firebaseConfig = {
    apiKey: "AIzaSyCnyZoNfk_YE7TfLeEXFo9GgA-QMj3tv6Q",
    authDomain: "intern-port-edfa7.firebaseapp.com",
    projectId: "intern-port-edfa7",
    storageBucket: "intern-port-edfa7.firebasestorage.app",
    messagingSenderId: "367076866368",
    appId: "1:367076866368:web:9c6559652cb0a78ddce2a5",
    measurementId: "G-5R5CEKCN44"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Constants
const ALLOWED_EMAIL = "medlifeplus@gmail.com";
const ADMIN_LIFF_ID = "2008959998-yjcNpaGt";
const MY_URL = window.location.origin + window.location.pathname.replace('admin.html', '') + 'admin.html';

// 🔥 Google Sign-In Logic
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            // Success handled by onAuthStateChanged
            console.log("Google Login Success:", result.user.email);
        })
        .catch((error) => {
            console.error("Google Login Error:", error);
            alert("Google Login Error: " + error.message);
            document.getElementById('login-error').innerText = "Google Error: " + error.message;
        });
}

// 🔥 LINE Login Logic (Admin)
async function loginWithLINE() {
    try {
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            const profile = await liff.getProfile();
            const user = liff.getDecodedIDToken();
            const lineEmail = user.email;

            if (lineEmail === ALLOWED_EMAIL) {
                // Custom token logic or manual trigger if already authorized
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('dashboard-container').style.display = 'block';
                document.getElementById('admin-email').innerText = lineEmail + " (via LINE)";
                initSystem();
            } else {
                alert("❌ Access Denied: Your LINE email (" + lineEmail + ") is not authorized.");
            }
        }
    } catch (e) {
        document.getElementById('login-error').innerText = "LINE Error: " + e.message;
    }
}

// 🔥 Magic Link Logic (Replaces Google Sign-In)
function sendMagicLink() {
    const email = document.getElementById('email-input').value;
    if (email !== ALLOWED_EMAIL) {
        alert("❌ Access Denied: Email not authorized.");
        return;
    }

    const actionCodeSettings = {
        url: MY_URL,
        handleCodeInApp: true
    };

    auth.sendSignInLinkToEmail(email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignIn', email);
            alert("✅ Link Sent! Check your email to login.");
        })
        .catch((error) => {
            document.getElementById('login-error').innerText = "Error: " + error.message;
        });
}

// Check for Magic Link on Load
if (auth.isSignInWithEmailLink(window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
        email = window.prompt('Please provide your email for confirmation');
    }
    auth.signInWithEmailLink(email, window.location.href)
        .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            // Success! onAuthStateChanged will handle the rest
            window.location.replace(MY_URL.split('?')[0]); // Clean URL
        })
        .catch((error) => {
            document.getElementById('login-error').innerText = "Link Error: " + error.message;
        });
}

// Logout function
function logout() { 
    auth.signOut().then(() => location.reload()); 
}

// Auth state observer
auth.onAuthStateChanged(user => {
    if (user) {
        if (user.email === ALLOWED_EMAIL) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'block';
            document.getElementById('admin-email').innerText = user.email;
            initSystem();
        } else {
            // User logged in but not authorized
            alert(`❌ Access Denied\nEmail: ${user.email}\nThis account is not authorized to access the Admin Portal.`);
            auth.signOut(); // Force logout so they can try again
        }
    }
});

// Expose functions to global scope
window.loginWithGoogle = loginWithGoogle;
window.loginWithLINE = loginWithLINE;
window.sendMagicLink = sendMagicLink;
window.logout = logout;
